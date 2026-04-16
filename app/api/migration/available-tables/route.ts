import sql from 'mssql'

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER || '',
  database: process.env.AZURE_SQL_DATABASE || '',
  user: process.env.AZURE_SQL_USER || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
}

export async function GET() {
  try {
    const pool = await sql.connect(config)

    const result = await pool.request().query(`
      SELECT
        t.TABLE_NAME,
        t.TABLE_SCHEMA,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c
         WHERE c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA) as column_count
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_NAME
    `)

    await pool.close()

    return Response.json({
      success: true,
      tables: result.recordset.map((t: { TABLE_NAME: string; TABLE_SCHEMA: string; column_count: number }) => ({
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
