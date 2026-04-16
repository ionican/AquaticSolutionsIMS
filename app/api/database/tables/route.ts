import { getSupabase } from "@/lib/supabase"

// Map of Azure SQL source names to Supabase target names
const TABLE_NAME_MAP: Record<string, string> = {
  'Ebsford_Clients': 'clients',
  'Ebsford_Contacts': 'contacts',
  'Ebsford_job_types': 'job_types',
  'Ebsford_job_classes': 'job_classes',
}

export async function GET() {
  try {
    const supabase = getSupabase()

    // Start with known system tables
    const knownTables = new Set([
      'jobs', 'events', 'clients', 'contacts',
      'job_types', 'job_classes', 'parameters',
      'migration_config'
    ])

    // Read the migration_tables parameter to discover additional tables
    const { data: paramData } = await supabase
      .from("parameters")
      .select("value")
      .eq("parameter", "migration_tables")
      .eq("company_id", 6)
      .single()

    if (paramData?.value) {
      const sourceNames = paramData.value.split(",").map((t: string) => t.trim()).filter(Boolean)
      for (const sourceName of sourceNames) {
        // Convert source name to Supabase table name (lowercase)
        const targetName = TABLE_NAME_MAP[sourceName] || sourceName
        knownTables.add(targetName.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
      }
    }

    // Probe each table to check it exists and get row count
    const tables = []
    for (const tableName of knownTables) {
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
