import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { requireApiPermission } from "@/lib/auth"

// Tables to show in the database overview (excluding system tables)
const APP_TABLES = [
  'jobs',
  'events',
  'clients',
  'contacts',
  'jobcontacts',
  'job_types',
  'job_classes',
  'parameters'
]

export async function GET() {
  const guard = await requireApiPermission("system.admin")
  if (guard.response) return guard.response

  try {
    const supabase = createSupabaseAdminClient()
    const tables = []
    
    for (const tableName of APP_TABLES) {
      // Get row count for each table
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
