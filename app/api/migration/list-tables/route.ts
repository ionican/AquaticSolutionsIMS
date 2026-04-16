import { NextResponse } from "next/server"
import { azureSqlQuery } from "@/lib/azure-sql"
import { requirePermission, isUser } from "@/lib/auth"

// Map of source table names to target table names in Supabase
const TABLE_NAME_MAP: Record<string, string> = {
  'Ebsford_Clients': 'Clients',
  'Ebsford_Contacts': 'Contacts',
  'Ebsford_job_types': 'job_types',
  'Ebsford_job_classes': 'job_classes',
}

export async function GET() {
  const auth = await requirePermission("migration:run")
  if (!isUser(auth)) return auth

  try {
    // Get tables from Azure SQL
    const tablesResult = await azureSqlQuery(`
      SELECT
        t.TABLE_NAME,
        t.TABLE_SCHEMA,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c
         WHERE c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA) as column_count
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_NAME
    `)

    // For each table, get columns and check for audit fields
    const tables = []
    for (const table of tablesResult.recordset) {
      const columnsResult = await azureSqlQuery(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${table.TABLE_NAME}' AND TABLE_SCHEMA = '${table.TABLE_SCHEMA}'
        ORDER BY ORDINAL_POSITION
      `)

      const columns = columnsResult.recordset
      const columnNames = columns.map((c: any) => c.COLUMN_NAME.toLowerCase())

      const hasAuditTrail =
        columnNames.includes('superceded') ||
        columnNames.includes('superseded') ||
        (columnNames.includes('modified') && columnNames.includes('linkid'))

      let rowCount = 0
      let currentRowCount = 0

      try {
        const countResult = await azureSqlQuery(`SELECT COUNT(*) as total FROM [${table.TABLE_SCHEMA}].[${table.TABLE_NAME}]`)
        rowCount = countResult.recordset[0].total

        if (hasAuditTrail) {
          const supercededCol = columnNames.includes('superceded') ? 'Superceded' :
                                columnNames.includes('superseded') ? 'Superseded' : null
          if (supercededCol) {
            const currentResult = await azureSqlQuery(`SELECT COUNT(*) as current FROM [${table.TABLE_SCHEMA}].[${table.TABLE_NAME}] WHERE ${supercededCol} IS NULL`)
            currentRowCount = currentResult.recordset[0].current
          }
        }
      } catch {
        // Ignore count errors
      }

      tables.push({
        name: TABLE_NAME_MAP[table.TABLE_NAME] || table.TABLE_NAME,
        schema: table.TABLE_SCHEMA,
        columnCount: table.column_count,
        rowCount,
        currentRowCount: hasAuditTrail ? currentRowCount : rowCount,
        hasAuditTrail,
        columns: columns.map((c: any) => ({
          name: c.COLUMN_NAME,
          type: c.DATA_TYPE,
          nullable: c.IS_NULLABLE === 'YES',
          maxLength: c.CHARACTER_MAXIMUM_LENGTH,
          precision: c.NUMERIC_PRECISION,
          scale: c.NUMERIC_SCALE,
        })),
      })
    }

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
