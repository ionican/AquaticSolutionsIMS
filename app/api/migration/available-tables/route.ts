import { azureSqlQuery } from "@/lib/azure-sql"

export async function GET() {
  try {
    const result = await azureSqlQuery(`
      SELECT
        t.TABLE_NAME,
        t.TABLE_SCHEMA,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c
         WHERE c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA) as column_count
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_NAME
    `)

    return Response.json({
      success: true,
      tables: result.recordset.map((t: any) => ({
        name: t.TABLE_NAME,
        schema: t.TABLE_SCHEMA,
        columnCount: t.column_count,
      })),
    })
  } catch (error) {
    console.error('[v0] Error listing available tables:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
