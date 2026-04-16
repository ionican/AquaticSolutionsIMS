import { createClient } from "@supabase/supabase-js"
import { azureSqlQuery } from "@/lib/azure-sql"
import { requirePermission, isUser } from "@/lib/auth"
import { auditLog } from "@/lib/audit"

interface TableConfig {
  name: string
  sourceName?: string
  createTableSQL?: string
  selectedColumns: string[]
}

export async function POST(request: Request) {
  const auth = await requirePermission("migration:run")
  if (!isUser(auth)) return auth

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ message: "Supabase connection not configured" }),
      { status: 400 }
    )
  }

  let body: { tables: TableConfig[] } = { tables: [] }
  try {
    body = await request.json()
  } catch {
    // If no body, process all tables with all columns
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"))
      }

      try {
        await auditLog(auth, "start_migration", "migration", {
          tables: body.tables.map((t: TableConfig) => t.name),
        })
        send({ type: "status", status: "connecting" })

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Test Azure SQL connection
        await azureSqlQuery("SELECT 1 AS test")

        const tablesToMigrate = body.tables.map(t => ({
          sourceName: t.sourceName || t.name,
          targetName: t.name,
          selectedColumns: t.selectedColumns,
          createTableSQL: t.createTableSQL,
        }))

        send({ type: "status", status: "migrating" })

        for (const { sourceName: tableName, targetName: targetTableName, selectedColumns: requestedColumns, createTableSQL } of tablesToMigrate) {
          send({ type: "table", table: targetTableName, status: "migrating" })

          try {
            // Validate table name
            if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
              send({ type: "table", table: targetTableName, status: "error", error: "Invalid table name" })
              continue
            }

            // Get table schema
            const schemaResult = await azureSqlQuery(`
              SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
              FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_NAME = '${tableName}'
              ORDER BY ORDINAL_POSITION
            `)

            const allColumns = schemaResult.recordset

            const selectedColumns = (requestedColumns && requestedColumns.length > 0)
              ? requestedColumns
              : allColumns.map((c: any) => c.COLUMN_NAME)

            if (selectedColumns.length === 0) {
              send({ type: "table", table: targetTableName, status: "error", error: "No columns selected for migration" })
              continue
            }

            // Check target table exists in Supabase via direct pg query
            const postgresTableName = targetTableName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
            let tableIsNew = false

            let tableExists = false
            const dbUrl = process.env.SUPABASE_DB_URL
            if (dbUrl) {
              const { Client } = await import("pg")
              const checkClient = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
              await checkClient.connect()
              const checkResult = await checkClient.query(
                `SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = $1)`,
                [postgresTableName]
              )
              tableExists = checkResult.rows[0]?.exists === true
              await checkClient.end()
            } else {
              // Fall back to REST API probe
              const { error: probeError } = await supabase
                .from(postgresTableName)
                .select('*', { count: 'exact', head: true })
              tableExists = !probeError
            }

            if (!tableExists) {
              // Table doesn't exist — try to auto-create it
              const dbUrl = process.env.SUPABASE_DB_URL
              if (!dbUrl) {
                send({
                  type: "table",
                  table: targetTableName,
                  status: "error",
                  error: `Table "${postgresTableName}" does not exist in Supabase. Set SUPABASE_DB_URL env var to enable auto-creation.`
                })
                continue
              }
              if (!createTableSQL) {
                send({
                  type: "table",
                  table: targetTableName,
                  status: "error",
                  error: `Table "${postgresTableName}" does not exist in Supabase. No CREATE TABLE SQL available — re-fetch the schema.`
                })
                continue
              }

              try {
                send({ type: "table", table: targetTableName, status: "migrating", message: "Creating table..." })
                const { Client } = await import("pg")
                const pgClient = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
                await pgClient.connect()
                await pgClient.query(createTableSQL)
                await pgClient.query("NOTIFY pgrst, 'reload schema'")
                await pgClient.end()
                console.log(`[v0] Auto-created table "${postgresTableName}" in Supabase`)
                tableIsNew = true
              } catch (createError: any) {
                send({
                  type: "table",
                  table: targetTableName,
                  status: "error",
                  error: `Failed to create table "${postgresTableName}": ${createError?.message || createError}`
                })
                continue
              }
            }

            // Detect primary key
            const primaryKeyMap: Record<string, string> = {
              'jobs': 'id',
              'events': 'task_id',
              'clients': 'client_id',
              'contacts': 'contact_id',
              'job_types': 'job_type_id',
              'job_classes': 'job_class_id',
              'parameters': 'id',
            }

            let pkColumn = primaryKeyMap[postgresTableName]
            if (!pkColumn) {
              const identityResult = await azureSqlQuery(`
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS c
                WHERE c.TABLE_NAME = '${tableName}'
                  AND COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') = 1
              `)
              pkColumn = identityResult.recordset.length > 0
                ? identityResult.recordset[0].COLUMN_NAME.toLowerCase()
                : allColumns[0]?.COLUMN_NAME?.toLowerCase() || 'id'
            }

            // For parameters table, use upsert to preserve app-created rows
            const useUpsert = postgresTableName === 'parameters'

            // Check for audit trail and company_id
            const hasAuditTrail = allColumns.some((col: any) => col.COLUMN_NAME === 'Superceded')
            const companyIdColumn = allColumns.find((col: any) => col.COLUMN_NAME.toLowerCase() === 'company_id')

            // Build data query
            let dataQuery = `SELECT ${selectedColumns.map((col: string) => `[${col}]`).join(', ')} FROM [${tableName}]`
            const whereConditions: string[] = []

            if (hasAuditTrail) whereConditions.push('Superceded IS NULL')
            if (companyIdColumn) whereConditions.push(`[${companyIdColumn.COLUMN_NAME}] = 6`)

            if (whereConditions.length > 0) {
              dataQuery += ` WHERE ${whereConditions.join(' AND ')}`
            }

            console.log(`[v0] Fetching data from ${tableName}`)
            const dataResult = await azureSqlQuery(dataQuery)
            const rows = dataResult.recordset

            // Convert column names to lowercase for PostgreSQL
            const lowercaseRows = rows.map((row: Record<string, unknown>) => {
              const newRow: Record<string, unknown> = {}
              for (const [key, value] of Object.entries(row)) {
                newRow[key.toLowerCase()] = value
              }
              return newRow
            })

            // Deduplicate by primary key
            const seenKeys = new Set<unknown>()
            const uniqueRows = lowercaseRows.filter((row: Record<string, unknown>) => {
              const pkValue = row[pkColumn]
              if (seenKeys.has(pkValue)) return false
              seenKeys.add(pkValue)
              return true
            })

            if (tableIsNew) {
              // For newly created tables, use direct pg connection (REST API cache won't know about them yet)
              const dbUrl = process.env.SUPABASE_DB_URL!
              const { Client } = await import("pg")
              const pgClient = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
              await pgClient.connect()

              if (uniqueRows.length > 0) {
                console.log(`[v0] Inserting ${uniqueRows.length} rows into ${postgresTableName} via pg`)
                const cols = Object.keys(uniqueRows[0])
                const batchSize = 100
                for (let i = 0; i < uniqueRows.length; i += batchSize) {
                  const batch = uniqueRows.slice(i, i + batchSize)
                  const values = batch.map((row, rowIdx) =>
                    `(${cols.map((col, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(', ')})`
                  ).join(', ')
                  const params = batch.flatMap(row => cols.map(col => row[col]))
                  await pgClient.query(
                    `INSERT INTO "${postgresTableName}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES ${values}`,
                    params
                  )
                }
              }

              await pgClient.query("NOTIFY pgrst, 'reload schema'")
              await pgClient.end()
            } else {
              // For existing tables, use Supabase REST API
              if (!useUpsert) {
                console.log(`[v0] Clearing existing data from ${postgresTableName}`)
                let { error: deleteError } = await supabase
                  .from(postgresTableName)
                  .delete()
                  .gte(pkColumn, 0)

                if (deleteError) {
                  const retryResult = await supabase
                    .from(postgresTableName)
                    .delete()
                    .not(pkColumn, 'is', null)
                  deleteError = retryResult.error
                }

                if (deleteError) {
                  console.log(`[v0] Delete error (may be empty table):`, deleteError.message)
                }
              }

              if (uniqueRows.length > 0) {
                console.log(`[v0] Inserting ${uniqueRows.length} rows into ${postgresTableName}`)
                const batchSize = 100
                for (let i = 0; i < uniqueRows.length; i += batchSize) {
                  const batch = uniqueRows.slice(i, i + batchSize)

                  if (useUpsert) {
                    const { error: upsertError } = await supabase
                      .from(postgresTableName)
                      .upsert(batch, { onConflict: pkColumn })
                    if (upsertError) throw upsertError
                  } else {
                    const { error: insertError } = await supabase
                      .from(postgresTableName)
                      .insert(batch)
                    if (insertError) throw insertError
                  }
                }
              }
            }

            send({ type: "table", table: targetTableName, status: "success", rowCount: uniqueRows.length })
          } catch (tableError: any) {
            console.error(`[v0] Error migrating ${tableName}:`, tableError)
            const errorMsg = tableError?.message || tableError?.details || tableError?.hint || String(tableError)
            send({ type: "table", table: targetTableName, status: "error", error: errorMsg })
          }
        }

        send({ type: "complete" })
      } catch (error) {
        console.error("[v0] Migration error:", error)
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Migration failed"
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  })
}
