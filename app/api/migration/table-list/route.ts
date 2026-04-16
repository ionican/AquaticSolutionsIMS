import { getSupabase } from "@/lib/supabase"

const PARAM_NAME = "migration_tables"
const COMPANY_ID = 6

const DEFAULT_TABLES = [
  'Jobs',
  'Events',
  'Ebsford_Clients',
  'Ebsford_Contacts',
  'Ebsford_job_types',
  'Ebsford_job_classes',
  'parameters'
]

export async function GET() {
  try {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("parameters")
      .select("value")
      .eq("parameter", PARAM_NAME)
      .eq("company_id", COMPANY_ID)
      .single()

    if (error || !data) {
      // Seed the default list
      const defaultValue = DEFAULT_TABLES.join(",")
      await supabase
        .from("parameters")
        .insert({ parameter: PARAM_NAME, value: defaultValue, company_id: COMPANY_ID })

      return Response.json({ success: true, tables: DEFAULT_TABLES })
    }

    const tables = data.value
      ? data.value.split(",").map((t: string) => t.trim()).filter(Boolean)
      : DEFAULT_TABLES

    return Response.json({ success: true, tables })
  } catch (error) {
    console.error("[v0] Error reading migration table list:", error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { tables } = await request.json()

    if (!Array.isArray(tables)) {
      return Response.json({ success: false, error: "tables array is required" }, { status: 400 })
    }

    const supabase = getSupabase()
    const value = tables.join(",")

    // Check if the parameter already exists
    const { data: existing } = await supabase
      .from("parameters")
      .select("id")
      .eq("parameter", PARAM_NAME)
      .eq("company_id", COMPANY_ID)
      .single()

    if (existing) {
      // Update existing row
      const { error } = await supabase
        .from("parameters")
        .update({ value })
        .eq("id", existing.id)

      if (error) throw error
    } else {
      // Insert new row
      const { error } = await supabase
        .from("parameters")
        .insert({ parameter: PARAM_NAME, value, company_id: COMPANY_ID })

      if (error) throw error
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error("[v0] Error saving migration table list:", error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
