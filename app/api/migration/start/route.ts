import { createClient } from "@supabase/supabase-js"

interface TableConfig {
  name: string
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

        // Map table configs for quick lookup
        const tableConfigMap = new Map(body.tables.map(t => [t.name, t.selectedColumns]))

        // Get list of migration tables from fetch-schema
        const MIGRATION_TABLES = [
          'Jobs',
          'Events', 
          'Ebsford_Clients',
          'Ebsford_Contacts',
          'JobContacts',
          'Ebsford_job_types',
          'Ebsford_job_classes',
          'parameters'
        ]

        // Map of source table names to target table names in Supabase
        const TABLE_NAME_MAP: Record<string, string> = {
          'Ebsford_Clients': 'Clients',
          'Ebsford_Contacts': 'Contacts',
          'JobContacts': 'jobcontacts',
          'Ebsford_job_types': 'job_types',
          'Ebsford_job_classes': 'job_classes',
        }

        send({ type: "status", status: "migrating" })

        for (const tableName of MIGRATION_TABLES) {
          const targetTableName = TABLE_NAME_MAP[tableName] || tableName
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
            
            // Filter to selected columns if specified
            const selectedColumns =
              tableConfigMap.get(tableName) ||
              tableConfigMap.get(targetTableName) ||
              allColumns.map((c: any) => c.COLUMN_NAME)
            
            if (selectedColumns.length === 0) {
              send({ 
                type: "table", 
                table: targetTableName, 
                status: "error", 
                error: "No columns selected for migration"
              })
              continue
            }

            // Tables are pre-created via Supabase migrations, so we just clear and insert data
            // First, clear existing data from the target table
            const postgresTableName = targetTableName.toLowerCase()
            console.log(`[v0] Clearing existing data from ${postgresTableName}`)
            
            // Map tables to their primary key columns
            const primaryKeyMap: Record<string, string> = {
              'jobs': 'id',
              'events': 'task_id',
              'clients': 'client_id',
              'contacts': 'contact_id',
              'jobcontacts': 'id',
              'job_types': 'job_type_id',
              'job_classes': 'job_class_id',
              'parameters': 'id',
            }
            
            const pkColumn = primaryKeyMap[postgresTableName] || 'id'
            
            // Delete all rows using the correct primary key column
            const { error: deleteError } = await supabase
              .from(postgresTableName)
              .delete()
              .gte(pkColumn, 0)
            
            if (deleteError) {
              console.log(`[v0] Delete error (may be empty table):`, deleteError.message)
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
                
                const { error: insertError } = await supabase
                  .from(postgresTableName)
                  .insert(batch)

                if (insertError) {
                  console.error(`[v0] Insert error for ${tableName}:`, insertError)
                  throw insertError
                }
              }
            }

            send({ type: "table", table: targetTableName, status: "success", rowCount: rows.length })
          } catch (tableError) {
            console.error(`[v0] Error migrating ${tableName}:`, tableError)
            send({ 
              type: "table", 
              table: targetTableName, 
              status: "error", 
              error: tableError instanceof Error ? tableError.message : "Unknown error"
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
