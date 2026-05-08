import { createSupabaseAdminClient } from "@/lib/supabase-server"

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient()

    // Count active jobs (excluding Completed and Lost)
    const { count: activeJobs } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["Contact", "Enquiry", "Quoting", "Quoted", "Contracted"])

    // Count total clients
    const { count: totalClients } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })

    // Count pending events (not completed, future or recent)
    const { count: pendingEvents } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("completed", false)

    // Count total jobs
    const { count: totalJobs } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })

    // Count total events
    const { count: totalEvents } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })

    return Response.json({
      activeJobs: activeJobs ?? 0,
      totalClients: totalClients ?? 0,
      pendingEvents: pendingEvents ?? 0,
      totalJobs: totalJobs ?? 0,
      totalEvents: totalEvents ?? 0,
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
