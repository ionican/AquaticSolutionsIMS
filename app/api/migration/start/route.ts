import { createClient } from "@supabase/supabase-js"
import { azureSqlVia, connectAzureSql } from "@/lib/azure-sql"
import { requireApiUser } from "@/lib/auth"

interface TableConfig {
  name: string
  selectedColumns: string[]
}

// Every imported table MUST be scoped to Aquatic Solutions (company_id = 6).
// Tables with a real company_id filter on it directly; relationship tables that
// lack a reliable company_id are scoped through their parent, so contacts and
// job-contacts belonging to other companies never come across.
//
// This fails CLOSED. A table with neither a company_id column nor a parent rule
// throws rather than importing every company's rows — returning null in that case
// is what let 5,242 out-of-scope contacts through before.
const COMPANY_ID = 6

// Relationship tables with no company_id of their own, scoped via their parent.
//
// The parent key MUST be globally unique, or `IN (...)` matches other companies'
// rows that happen to reuse the same key value. JobContacts used to be scoped
// here on enquiry_id — a smallint reused across companies, with no FK to Jobs —
// which matched 6,101 rows of which 3,321 belonged to companies 5, 7 and 8. It
// now takes the direct company_id filter below: that column is fully populated
// in the source (0 nulls across 9,419 rows) and yields the correct 2,782.
const PARENT_SCOPE_SQL: Record<string, string> = {
  // Ebsford_Contacts has no company_id column at all. client_id is the primary
  // key of Ebsford_Clients and carries a real FK, so it is globally unique.
  Ebsford_Contacts: `[client_id] IN (SELECT [client_id] FROM [Ebsford_Clients] WHERE [company_id] = ${COMPANY_ID})`,
}

// Tables deliberately imported without a company filter. Adding one is a
// conscious decision that it holds no company-specific rows — never a default.
const UNSCOPED_TABLES = new Set<string>()

function companyScopeSql(
  sourceTable: string,
  columns: Array<{ COLUMN_NAME: string }>
): string | null {
  const parentScope = PARENT_SCOPE_SQL[sourceTable]
  if (parentScope) {
    return parentScope
  }

  const companyIdColumn = columns.find(
    (col) => col.COLUMN_NAME.toLowerCase() === "company_id"
  )
  if (companyIdColumn) {
    return `[${companyIdColumn.COLUMN_NAME}] = ${COMPANY_ID}`
  }

  if (UNSCOPED_TABLES.has(sourceTable)) {
    return null
  }

  throw new Error(
    `Refusing to import ${sourceTable}: no company_id column and no parent scope ` +
      `rule, so every company's rows would be imported. Add an entry to ` +
      `PARENT_SCOPE_SQL, or to UNSCOPED_TABLES if the table genuinely holds no ` +
      `company-specific data.`
  )
}

export async function POST(request: Request) {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const server = process.env.AZURE_SQL_SERVER
  const database = process.env.AZURE_SQL_DATABASE
  const user = process.env.AZURE_SQL_USER
  const password = process.env.AZURE_SQL_PASSWORD
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const via = azureSqlVia()

  // Only the direct transport needs the four SQL credentials; a proxy-only
  // deployment is valid because the Function holds them.
  if (via === "direct" && (!server || !database || !user || !password)) {
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
        send({ type: "status", status: "connecting", via })

        const client = await connectAzureSql()
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

        send({ type: "status", status: "migrating", via: client.via })

        for (const tableName of MIGRATION_TABLES) {
          const targetTableName = TABLE_NAME_MAP[tableName] || tableName
          send({ type: "table", table: targetTableName, status: "migrating" })

          try {
            // Get table schema - table name is from our controlled whitelist so safe to interpolate
            const schemaResult = await client.query(`
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

            // selectedColumns arrives in the POST body and is interpolated into
            // dataQuery below, so it must be constrained to columns that actually
            // exist in the source schema. Resolve each one to its canonical name
            // from INFORMATION_SCHEMA and interpolate THAT, so no caller-supplied
            // string ever reaches the SQL text; a value like
            //   id] FROM [Jobs]; WAITFOR DELAY '00:00:05'; SELECT [id
            // is rejected here rather than escaped.
            const canonicalByLower = new Map(
              allColumns.map((c: any) => [String(c.COLUMN_NAME).toLowerCase(), String(c.COLUMN_NAME)])
            )
            const unknownColumns = selectedColumns.filter(
              (col: string) => !canonicalByLower.has(String(col).toLowerCase())
            )

            if (unknownColumns.length > 0) {
              send({
                type: "table",
                table: targetTableName,
                status: "error",
                error: `Unknown column(s) for ${tableName}: ${unknownColumns.join(", ")}`
              })
              continue
            }

            const safeColumns = selectedColumns.map(
              (col: string) => canonicalByLower.get(String(col).toLowerCase()) as string
            )

            const postgresTableName = targetTableName.toLowerCase()

            // Must match the real primary key in Postgres. The dedup pass below
            // guards this column, so a wrong entry lets a genuine PK violation
            // reach the insert and throw mid-table. jobs is keyed on enquiry_id.
            const primaryKeyMap: Record<string, string> = {
              'jobs': 'enquiry_id',
              'events': 'task_id',
              'clients': 'client_id',
              'contacts': 'contact_id',
              'jobcontacts': 'id',
              'job_types': 'job_type_id',
              'job_classes': 'job_class_id',
              'parameters': 'id',
            }

            const pkColumn = primaryKeyMap[postgresTableName] || 'id'

            // Check if table has audit trail columns (Superceded)
            const hasAuditTrail = allColumns.some((col: any) =>
              col.COLUMN_NAME === 'Superceded'
            )

            // Build data query - filter for current records if audit trail exists.
            // INVARIANT: every table is scoped to company 6 (Aquatic Solutions).
            let dataQuery = `SELECT ${safeColumns.map((col: string) => `[${col}]`).join(', ')} FROM [${tableName}]`
            const whereConditions: string[] = []

            if (hasAuditTrail) {
              whereConditions.push('Superceded IS NULL')
            }

            // Throws for an unscoped table. Deliberately evaluated before the
            // delete below, so a scoping failure never empties the target.
            const companyScope = companyScopeSql(tableName, allColumns)
            if (companyScope) {
              whereConditions.push(companyScope)
            }

            if (whereConditions.length > 0) {
              dataQuery += ` WHERE ${whereConditions.join(' AND ')}`
            }

            // Read the source BEFORE clearing the target. The clear/insert pair is
            // not transactional, so a failed read must leave the existing rows
            // intact rather than truncating the table to nothing.
            console.log(`[v0] Fetching data from ${tableName}`)

            const dataResult = await client.query(dataQuery)
            const rows = dataResult.recordset

            // Tables are pre-created via Supabase migrations, so we just clear and insert data
            console.log(`[v0] Clearing existing data from ${postgresTableName}`)

            const { error: deleteError } = await supabase
              .from(postgresTableName)
              .delete()
              .gte(pkColumn, 0)

            if (deleteError) {
              console.log(`[v0] Delete error (may be empty table):`, deleteError.message)
            }

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

        await client.close()
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
