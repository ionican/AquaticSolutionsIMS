import { getSupabase } from "@/lib/supabase"

export async function GET() {
  try {
    const supabase = getSupabase()

    // Query Supabase for all user-created tables via pg_tables
    const { data: pgTables, error: pgError } = await supabase
      .rpc('get_table_names')
      .select('*')

    // If the RPC doesn't exist, fall back to a known list + discovery
    let tableNames: string[]

    if (pgError || !pgTables) {
      // Fallback: try a broad set of known table names and discover which exist
      const candidates = [
        'jobs', 'events', 'clients', 'contacts',
        'job_types', 'job_classes', 'parameters',
        'migration_config'
      ]

      // Also try to discover tables by querying information_schema via raw SQL
      const { data: schemaData } = await supabase
        .from('information_schema.tables' as any)
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE')

      if (schemaData && schemaData.length > 0) {
        tableNames = schemaData.map((t: any) => t.table_name)
      } else {
        // Last resort: probe each candidate
        tableNames = []
        for (const name of candidates) {
          const { error } = await supabase
            .from(name)
            .select('*', { count: 'exact', head: true })
          if (!error) {
            tableNames.push(name)
          }
        }
      }
    } else {
      tableNames = pgTables.map((t: any) => t.table_name || t.tablename)
    }

    // Get row counts for each table
    const tables = []
    for (const tableName of tableNames) {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })

      if (!error) {
        tables.push({
          name: tableName,
          rowCount: count || 0
        })
      }
    }

    return Response.json({
      success: true,
      tables: tables.sort((a, b) => a.name.localeCompare(b.name))
    })
  } catch (error) {
    console.error('[v0] Error fetching tables:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
