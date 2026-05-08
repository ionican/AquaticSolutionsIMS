import { NextResponse } from "next/server"
import sql from "mssql"

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER || "",
  database: process.env.AZURE_SQL_DATABASE || "",
  user: process.env.AZURE_SQL_USER || "",
  password: process.env.AZURE_SQL_PASSWORD || "",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
}

// Tables to migrate from the legacy system
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

export async function GET() {
  try {
    const pool = await sql.connect(config)
    
    // Get only the specific tables we need for migration
    const tableList = MIGRATION_TABLES.map(t => `'${t}'`).join(',')
    const tablesResult = await pool.request().query(`
      SELECT 
        t.TABLE_NAME,
        t.TABLE_SCHEMA,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA) as column_count
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE t.TABLE_TYPE = 'BASE TABLE'
        AND t.TABLE_NAME IN (${tableList})
      ORDER BY t.TABLE_NAME
    `)

    // For each table, get columns and check for audit fields
    const tables = await Promise.all(
      tablesResult.recordset.map(async (table) => {
        const columnsResult = await pool.request().query(`
          SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            CHARACTER_MAXIMUM_LENGTH,
            NUMERIC_PRECISION,
            NUMERIC_SCALE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${table.TABLE_NAME}' AND TABLE_SCHEMA = '${table.TABLE_SCHEMA}'
          ORDER BY ORDINAL_POSITION
        `)

        const columns = columnsResult.recordset
        const columnNames = columns.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME.toLowerCase())
        
        // Check for audit trail fields
        const hasAuditTrail = 
          columnNames.includes('superceded') || 
          columnNames.includes('superseded') ||
          (columnNames.includes('modified') && columnNames.includes('linkid'))

        // Get row count (with superceded filter if applicable)
        let rowCount = 0
        let currentRowCount = 0
        
        try {
          const countResult = await pool.request().query(`
            SELECT COUNT(*) as total FROM [${table.TABLE_SCHEMA}].[${table.TABLE_NAME}]
          `)
          rowCount = countResult.recordset[0].total

          if (hasAuditTrail) {
            const supercededCol = columnNames.includes('superceded') ? 'Superceded' : 
                                  columnNames.includes('superseded') ? 'Superseded' : null
            if (supercededCol) {
              const currentResult = await pool.request().query(`
                SELECT COUNT(*) as current FROM [${table.TABLE_SCHEMA}].[${table.TABLE_NAME}] WHERE ${supercededCol} IS NULL
              `)
              currentRowCount = currentResult.recordset[0].current
            }
          }
        } catch {
          // Ignore count errors for views or restricted tables
        }

        return {
          name: TABLE_NAME_MAP[table.TABLE_NAME] || table.TABLE_NAME,
          schema: table.TABLE_SCHEMA,
          columnCount: table.column_count,
          rowCount,
          currentRowCount: hasAuditTrail ? currentRowCount : rowCount,
          hasAuditTrail,
          columns: columns.map((c: { 
            COLUMN_NAME: string
            DATA_TYPE: string
            IS_NULLABLE: string
            CHARACTER_MAXIMUM_LENGTH: number | null
            NUMERIC_PRECISION: number | null
            NUMERIC_SCALE: number | null
          }) => ({
            name: c.COLUMN_NAME,
            type: c.DATA_TYPE,
            nullable: c.IS_NULLABLE === 'YES',
            maxLength: c.CHARACTER_MAXIMUM_LENGTH,
            precision: c.NUMERIC_PRECISION,
            scale: c.NUMERIC_SCALE,
          })),
        }
      })
    )

    await pool.close()

    return NextResponse.json({ 
      success: true, 
      tables,
      totalTables: tables.length 
    })
  } catch (error) {
    console.error("List tables error:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to list tables" 
      },
      { status: 500 }
    )
  }
}
