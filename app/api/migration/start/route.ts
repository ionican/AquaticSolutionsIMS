import { createClient } from "@supabase/supabase-js"

interface TableConfig {
  name: string
  sourceName?: string
  createTableSQL?: string
  selectedColumns: string[]
}

export async function POST(request: Request) {
  const server = process.env.AZURE_SQL_SERVER
  const database = process.env.AZURE_SQL_DATABASE
  const user = process.env.AZURE_SQL_USER
  const password = process.env.AZURE_SQL_PASSWORD
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!server || !database || !user || !password) {
    return new Response(
      JSON.stringify({ message: "Azure SQL connection not configured" }),
      { status: 400 }
    )
  }

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
        send({ type: "status", status: "connecting" })

        const sql = await import("mssql")
        
        const config: sql.config = {
          server,
          database,
          user,
          password,
          options: {
            encrypt: true,
            trustServerCertificate: false,
          },
        }

        const pool = await sql.connect(config)
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Build table list from request body
        // Each entry has: name (display/target name), sourceName (Azure SQL name), selectedColumns
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
            // Get table schema - table name is from our controlled whitelist so safe to interpolate
            const schemaResult = await pool.request().query(`
              SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
              FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_NAME = '${tableName}'
              ORDER BY ORDINAL_POSITION
            `)

            const allColumns = schemaResult.recordset
            
            // Use columns from request, or fall back to all columns
            const selectedColumns = (requestedColumns && requestedColumns.length > 0)
              ? requestedColumns
              : allColumns.map((c: any) => c.COLUMN_NAME)
            
            if (selectedColumns.length === 0) {
              send({ 
                type: "table", 
                table: targetTableName, 
                status: "error", 
                error: "No columns selected for migration"
              })
              continue
            }

            // Check target table exists in Supabase before attempting migration
            const postgresTableName = targetTableName.toLowerCase().replace(/[^a-z0-9_]/g, '_')

            const { error: probeError } = await supabase
              .from(postgresTableName)
              .select('*', { count: 'exact', head: true })

            if (probeError) {
              // Table doesn't exist — try to auto-create it
              const dbUrl = process.env.SUPABASE_DB_URL
              if (!dbUrl || !createTableSQL) {
                send({
                  type: "table",
                  table: targetTableName,
                  status: "error",
                  error: `Table "${postgresTableName}" does not exist in Supabase. ${!dbUrl ? 'Set SUPABASE_DB_URL env var to enable auto-creation.' : 'No CREATE TABLE SQL available.'}`
                })
                continue
              }

              try {
                send({ type: "table", table: targetTableName, status: "migrating", message: "Creating table..." })
                const { Client } = await import("pg")
                const pgClient = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
                await pgClient.connect()
                await pgClient.query(createTableSQL)
                await pgClient.end()
                console.log(`[v0] Auto-created table "${postgresTableName}" in Supabase`)
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

            // Map known tables to their primary key columns
            const primaryKeyMap: Record<string, string> = {
              'jobs': 'id',
              'events': 'task_id',
              'clients': 'client_id',
              'contacts': 'contact_id',
              'job_types': 'job_type_id',
              'job_classes': 'job_class_id',
              'parameters': 'id',
            }

            // For unknown tables, try to detect PK: look for identity column or first column
            let pkColumn = primaryKeyMap[postgresTableName]
            if (!pkColumn) {
              const identityResult = await pool.request().query(`
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS c
                WHERE c.TABLE_NAME = '${tableName}'
                  AND COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') = 1
              `)
              pkColumn = identityResult.recordset.length > 0
                ? identityResult.recordset[0].COLUMN_NAME.toLowerCase()
                : allColumns[0]?.COLUMN_NAME?.toLowerCase() || 'id'
            }

            // For parameters table, use upsert to preserve app-created rows
            // For all other tables, clear and re-insert
            const useUpsert = postgresTableName === 'parameters'

            if (!useUpsert) {
              console.log(`[v0] Clearing existing data from ${postgresTableName}`)
              // Try numeric delete first, fall back to not-null filter
              let { error: deleteError } = await supabase
                .from(postgresTableName)
                .delete()
                .gte(pkColumn, 0)

              if (deleteError) {
                // Retry with a broader filter for non-numeric PKs
                const retryResult = await supabase
                  .from(postgresTableName)
                  .delete()
                  .not(pkColumn, 'is', null)
                deleteError = retryResult.error
              }

              if (deleteError) {
                console.log(`[v0] Delete error (may be empty table):`, deleteError.message)
              }
            } else {
              console.log(`[v0] Using upsert for ${postgresTableName} to preserve app-created rows`)
            }

            // Check if table has audit trail columns (Superceded)
            const hasAuditTrail = allColumns.some((col: any) => 
              col.COLUMN_NAME === 'Superceded'
            )
            
            // Check if table has company_id column (case-insensitive check)
            const companyIdColumn = allColumns.find((col: any) => 
              col.COLUMN_NAME.toLowerCase() === 'company_id'
            )

            // Build data query - filter for current records if audit trail exists
            // Also filter by company_id = 6 if the column exists
            let dataQuery = `SELECT ${selectedColumns.map((col: string) => `[${col}]`).join(', ')} FROM [${tableName}]`
            const whereConditions: string[] = []
            
            if (hasAuditTrail) {
              whereConditions.push('Superceded IS NULL')
            }
            
            if (companyIdColumn) {
              whereConditions.push(`[${companyIdColumn.COLUMN_NAME}] = 6`)
            }
            
            if (whereConditions.length > 0) {
              dataQuery += ` WHERE ${whereConditions.join(' AND ')}`
            }

            console.log(`[v0] Fetching data from ${tableName}`)

            const dataResult = await pool.request().query(dataQuery)
            const rows = dataResult.recordset

            if (rows.length > 0) {
              console.log(`[v0] Inserting ${rows.length} rows into ${postgresTableName}`)
              
              // Convert column names to lowercase for PostgreSQL
              const lowercaseRows = rows.map((row: Record<string, unknown>) => {
                const newRow: Record<string, unknown> = {}
                for (const [key, value] of Object.entries(row)) {
                  newRow[key.toLowerCase()] = value
                }
                return newRow
              })
              
              // Deduplicate rows by primary key to avoid constraint violations
              const seenKeys = new Set<unknown>()
              const uniqueRows = lowercaseRows.filter((row: Record<string, unknown>) => {
                const pkValue = row[pkColumn]
                if (seenKeys.has(pkValue)) {
                  console.log(`[v0] Skipping duplicate ${pkColumn}=${pkValue} in ${postgresTableName}`)
                  return false
                }
                seenKeys.add(pkValue)
                return true
              })
              
              console.log(`[v0] After deduplication: ${uniqueRows.length} unique rows`)
              
              // Insert data in batches
              const batchSize = 100
              for (let i = 0; i < uniqueRows.length; i += batchSize) {
                const batch = uniqueRows.slice(i, i + batchSize)

                if (useUpsert) {
                  // Upsert: insert or update on primary key conflict
                  const { error: upsertError } = await supabase
                    .from(postgresTableName)
                    .upsert(batch, { onConflict: pkColumn })

                  if (upsertError) {
                    console.error(`[v0] Upsert error for ${tableName}:`, upsertError)
                    throw upsertError
                  }
                } else {
                  const { error: insertError } = await supabase
                    .from(postgresTableName)
                    .insert(batch)

                  if (insertError) {
                    console.error(`[v0] Insert error for ${tableName}:`, insertError)
                    throw insertError
                  }
                }
              }
            }

            send({ type: "table", table: targetTableName, status: "success", rowCount: rows.length })
          } catch (tableError: any) {
            console.error(`[v0] Error migrating ${tableName}:`, tableError)
            const errorMsg = tableError?.message || tableError?.details || tableError?.hint || String(tableError)
            send({
              type: "table",
              table: targetTableName,
              status: "error",
              error: errorMsg
            })
          }
        }

        await pool.close()
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

function mapSqlServerToPostgres(
  sqlType: string, 
  maxLength: number | null,
  precision: number | null,
  scale: number | null
): string {
  const typeMap: Record<string, string> = {
    "int": "INTEGER",
    "bigint": "BIGINT",
    "smallint": "SMALLINT",
    "tinyint": "SMALLINT",
    "bit": "BOOLEAN",
    "decimal": precision && scale ? `DECIMAL(${precision},${scale})` : "DECIMAL",
    "numeric": precision && scale ? `NUMERIC(${precision},${scale})` : "NUMERIC",
    "money": "DECIMAL(19,4)",
    "smallmoney": "DECIMAL(10,4)",
    "float": "DOUBLE PRECISION",
    "real": "REAL",
    "datetime": "TIMESTAMP",
    "datetime2": "TIMESTAMP",
    "smalldatetime": "TIMESTAMP",
    "date": "DATE",
    "time": "TIME",
    "datetimeoffset": "TIMESTAMPTZ",
    "char": maxLength ? `CHAR(${maxLength})` : "CHAR(1)",
    "varchar": maxLength && maxLength > 0 ? `VARCHAR(${maxLength})` : "TEXT",
    "text": "TEXT",
    "nchar": maxLength ? `CHAR(${maxLength})` : "CHAR(1)",
    "nvarchar": maxLength && maxLength > 0 ? `VARCHAR(${maxLength})` : "TEXT",
    "ntext": "TEXT",
    "binary": "BYTEA",
    "varbinary": "BYTEA",
    "image": "BYTEA",
    "uniqueidentifier": "UUID",
    "xml": "XML",
  }

  return typeMap[sqlType.toLowerCase()] || "TEXT"
}
