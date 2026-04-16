import { azureSqlQuery } from "@/lib/azure-sql"

// Default tables to migrate from the legacy system
const DEFAULT_MIGRATION_TABLES = [
  'Jobs',
  'Events',
  'Ebsford_Clients',
  'Ebsford_Contacts',
  'Ebsford_job_types',
  'Ebsford_job_classes',
  'parameters'
]

// Map of source table names to target table names in Supabase
const TABLE_NAME_MAP: Record<string, string> = {
  'Ebsford_Clients': 'Clients',
  'Ebsford_Contacts': 'Contacts',
  'Ebsford_job_types': 'job_types',
  'Ebsford_job_classes': 'job_classes',
}

// Audit trail columns to exclude from migration
const AUDIT_COLUMNS = ['Modified', 'Superceded', 'LinkId']

function mapSqlServerTypeToPostgres(sqlType: string, maxLength: number | null, precision: number | null, scale: number | null): string {
  const type = sqlType.toLowerCase()
  switch (type) {
    case 'int': return 'INTEGER'
    case 'bigint': return 'BIGINT'
    case 'smallint': return 'SMALLINT'
    case 'tinyint': return 'SMALLINT'
    case 'bit': return 'BOOLEAN'
    case 'decimal': case 'numeric': return `NUMERIC(${precision || 18}, ${scale || 2})`
    case 'money': case 'smallmoney': return 'NUMERIC(19, 4)'
    case 'float': return 'DOUBLE PRECISION'
    case 'real': return 'REAL'
    case 'datetime': case 'datetime2': case 'smalldatetime': return 'TIMESTAMP'
    case 'date': return 'DATE'
    case 'time': return 'TIME'
    case 'datetimeoffset': return 'TIMESTAMPTZ'
    case 'char': return `CHAR(${maxLength || 1})`
    case 'varchar': return maxLength === -1 ? 'TEXT' : `VARCHAR(${maxLength || 255})`
    case 'nchar': return `CHAR(${maxLength || 1})`
    case 'nvarchar': return maxLength === -1 ? 'TEXT' : `VARCHAR(${maxLength || 255})`
    case 'text': case 'ntext': return 'TEXT'
    case 'binary': case 'varbinary': case 'image': return 'BYTEA'
    case 'uniqueidentifier': return 'UUID'
    case 'xml': return 'XML'
    default: return 'TEXT'
  }
}

async function fetchTablesSchema(tableNames: string[]) {
  const tables: Array<{
    name: string
    sourceName: string
    columns: Array<{
      name: string
      sqlServerType: string
      postgresType: string
      isNullable: boolean
      isIdentity: boolean
      isAuditColumn: boolean
    }>
    hasAuditTrail: boolean
    currentRowCount: number
    totalRowCount: number
    createTableSQL: string
  }> = []

  for (const tableName of tableNames) {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) continue

    const columnsResult = await azureSqlQuery(`
      SELECT
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE,
        c.IS_NULLABLE,
        COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as IS_IDENTITY
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_NAME = '${tableName}'
      ORDER BY c.ORDINAL_POSITION
    `)

    if (columnsResult.recordset.length === 0) continue

    const columns = columnsResult.recordset.map((col: any) => ({
      name: col.COLUMN_NAME,
      sqlServerType: col.DATA_TYPE,
      postgresType: mapSqlServerTypeToPostgres(
        col.DATA_TYPE,
        col.CHARACTER_MAXIMUM_LENGTH,
        col.NUMERIC_PRECISION,
        col.NUMERIC_SCALE
      ),
      isNullable: col.IS_NULLABLE === 'YES',
      isIdentity: col.IS_IDENTITY === 1,
      isAuditColumn: AUDIT_COLUMNS.some(ac => ac.toLowerCase() === col.COLUMN_NAME.toLowerCase())
    }))

    const hasAuditTrail = columns.some((c: any) => c.isAuditColumn)

    let totalRowCount = 0
    let currentRowCount = 0

    try {
      const totalCountResult = await azureSqlQuery(`SELECT COUNT(*) as cnt FROM [${tableName}]`)
      totalRowCount = totalCountResult.recordset[0].cnt

      if (hasAuditTrail) {
        const currentCountResult = await azureSqlQuery(`SELECT COUNT(*) as cnt FROM [${tableName}] WHERE Superceded IS NULL`)
        currentRowCount = currentCountResult.recordset[0].cnt
      } else {
        currentRowCount = totalRowCount
      }
    } catch {
      // Table might not exist or other error
    }

    const nonAuditColumns = columns.filter((c: any) => !c.isAuditColumn)
    const targetTableName = TABLE_NAME_MAP[tableName] || tableName
    const postgresTableName = targetTableName.toLowerCase().replace(/[^a-z0-9_]/g, '_')

    const columnDefs = nonAuditColumns.map((col: any) => {
      let def = `  "${col.name.toLowerCase()}" ${col.postgresType}`
      if (col.isIdentity) def = `  "${col.name.toLowerCase()}" SERIAL`
      if (!col.isNullable && !col.isIdentity) def += ' NOT NULL'
      return def
    })

    const pkColumn = nonAuditColumns.find((c: any) => c.isIdentity) || nonAuditColumns[0]
    const pkName = pkColumn ? pkColumn.name.toLowerCase() : null

    const createTableSQL = `CREATE TABLE IF NOT EXISTS "${postgresTableName}" (\n${columnDefs.join(',\n')}${pkName ? `,\n  PRIMARY KEY ("${pkName}")` : ''}\n);`

    tables.push({
      name: TABLE_NAME_MAP[tableName] || tableName,
      sourceName: tableName,
      columns,
      hasAuditTrail,
      currentRowCount,
      totalRowCount,
      createTableSQL
    })
  }

  return tables
}

export async function GET() {
  try {
    const tables = await fetchTablesSchema(DEFAULT_MIGRATION_TABLES)
    return Response.json({ success: true, tables })
  } catch (error) {
    console.error('[v0] Schema fetch error:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { tables: tableNames } = await request.json()
    if (!Array.isArray(tableNames) || tableNames.length === 0) {
      return Response.json({ success: false, error: 'tables array is required' }, { status: 400 })
    }
    const tables = await fetchTablesSchema(tableNames)
    return Response.json({ success: true, tables })
  } catch (error) {
    console.error('[v0] Schema fetch error:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
