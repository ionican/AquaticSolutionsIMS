import { getSupabase } from "@/lib/supabase"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  try {
    const { tableName } = await params

    // Validate table name contains only safe characters
    if (!/^[a-z0-9_]+$/i.test(tableName)) {
      return Response.json(
        { success: false, error: 'Invalid table name' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()
    const url = new URL(request.url)
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const limit = parseInt(url.searchParams.get('limit') || '100')

    // Get total count
    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
    
    // Get paginated data
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(offset, offset + limit - 1)
    
    if (error) {
      throw error
    }
    
    // Get column names from first row or make another query
    let columns: string[] = []
    if (data && data.length > 0) {
      columns = Object.keys(data[0])
    } else {
      // If no data, we need to get column info differently
      // Just return empty for now
    }
    
    return Response.json({ 
      success: true, 
      data: data || [],
      columns,
      totalCount: count || 0,
      offset,
      limit
    })
  } catch (error) {
    console.error('[v0] Error fetching table data:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
