import { getSupabase } from "@/lib/supabase"
import { requirePermission, isUser } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { MAX_PAGE_SIZE } from "@/lib/auth-types"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  const auth = await requirePermission("database:browse")
  if (!isUser(auth)) return auth

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
    const requestedLimit = parseInt(url.searchParams.get('limit') || '50')
    const limit = Math.min(Math.max(1, requestedLimit), MAX_PAGE_SIZE)

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
    }

    await auditLog(auth, "browse_table", "database", { table: tableName, offset, limit })

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
