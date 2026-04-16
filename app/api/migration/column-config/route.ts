import { getSupabase } from "@/lib/supabase"

export async function GET(request: Request) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get("table")

    if (!tableName) {
      return Response.json({ error: "table parameter required" }, { status: 400 })
    }

    // Get column selections for this table
    const { data, error } = await supabase
      .from("migration_config")
      .select("*")
      .eq("table_name", tableName)

    if (error) throw error

    return Response.json({ success: true, config: data })
  } catch (error) {
    console.error("[v0] Error loading config:", error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const { tableName, columns } = await request.json()

    if (!tableName || !Array.isArray(columns)) {
      return Response.json({ error: "tableName and columns required" }, { status: 400 })
    }

    // Delete existing config for this table
    await supabase.from("migration_config").delete().eq("table_name", tableName)

    // Insert new config
    const configRows = columns.map((col: { name: string; selected: boolean }) => ({
      table_name: tableName,
      column_name: col.name,
      selected: col.selected,
    }))

    const { error } = await supabase.from("migration_config").insert(configRows)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    console.error("[v0] Error saving config:", error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
