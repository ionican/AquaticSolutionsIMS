import { createSupabaseAdminClient } from "@/lib/supabase-server"

// "Ready to invoice" = a won (Contracted) job whose end date has arrived
// (contract_end is today or earlier). Scoped to Strettons (company_id = 6).
// Once a "mark as invoiced" step exists, invoiced jobs will be excluded here.
const COMPANY_ID = 6
const DISPLAY_LIMIT = 50

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient()
    const today = new Date().toISOString().slice(0, 10)

    // Totals across all matching jobs (value columns only, kept light).
    const { data: allRows, error: allErr } = await supabase
      .from("jobs")
      .select("id, ordervalue, quotation_value")
      .eq("company_id", COMPANY_ID)
      .eq("status", "Contracted")
      .not("contract_end", "is", null)
      .lte("contract_end", today)
    if (allErr) throw allErr

    const count = allRows?.length ?? 0
    const totalValue = (allRows ?? []).reduce(
      (sum, r) => sum + (r.ordervalue ?? r.quotation_value ?? 0),
      0
    )

    // Most-recently-ended jobs for the on-screen list.
    const { data: rows, error } = await supabase
      .from("jobs")
      .select("id, enquiry_id, project_name, site, client_id, contract_end, ordervalue, quotation_value")
      .eq("company_id", COMPANY_ID)
      .eq("status", "Contracted")
      .not("contract_end", "is", null)
      .lte("contract_end", today)
      .order("contract_end", { ascending: false })
      .limit(DISPLAY_LIMIT)
    if (error) throw error

    // Attach client business names (no FK join defined, so look them up).
    const clientIds = [...new Set((rows ?? []).map((r) => r.client_id).filter(Boolean))]
    const { data: clients } = clientIds.length
      ? await supabase.from("clients").select("client_id, business_name").in("client_id", clientIds)
      : { data: [] }
    const clientMap = Object.fromEntries(
      (clients || []).map((c) => [c.client_id, c.business_name])
    )

    const data = (rows ?? []).map((r) => ({
      id: r.id,
      enquiry_id: r.enquiry_id,
      project_name: r.project_name,
      site: r.site,
      contract_end: r.contract_end,
      value: r.ordervalue ?? r.quotation_value ?? null,
      business_name: clientMap[r.client_id] ?? null,
    }))

    return Response.json({ count, totalValue, data })
  } catch (error) {
    console.error("Ready-to-invoice error:", error)
    return Response.json({ error: "Failed to load ready-to-invoice" }, { status: 500 })
  }
}
