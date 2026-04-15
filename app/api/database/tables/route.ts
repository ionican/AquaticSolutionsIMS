import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Tables to show in the database overview (excluding system tables)
const APP_TABLES = [
  'jobs',
  'events',
  'clients',
  'contacts',
  'job_types',
  'job_classes',
  'parameters'
]

export async function GET() {
  try {
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
