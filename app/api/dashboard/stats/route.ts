import { supabase } from "@/lib/supabase-server"

export async function GET() {
  try {
    // Count active jobs (excluding Completed and Lost)
    const { count: activeJobs, error: activeJobsError } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["Contact", "Enquiry", "Quoting", "Quoted", "Contracted"])

    if (activeJobsError) {
      console.error("[v0] Active jobs query error:", activeJobsError)
      throw activeJobsError
    }

    // Count total clients
    const { count: totalClients, error: clientsError } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })

    if (clientsError) {
      console.error("[v0] Total clients query error:", clientsError)
      throw clientsError
    }

    // Count pending events (not completed, future or recent)
    const { count: pendingEvents, error: pendingEventsError } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("completed", false)

    if (pendingEventsError) {
      console.error("[v0] Pending events query error:", pendingEventsError)
      throw pendingEventsError
    }

    // Count total jobs
    const { count: totalJobs, error: totalJobsError } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })

    if (totalJobsError) {
      console.error("[v0] Total jobs query error:", totalJobsError)
      throw totalJobsError
    }

    // Count total events
    const { count: totalEvents, error: totalEventsError } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })

    if (totalEventsError) {
      console.error("[v0] Total events query error:", totalEventsError)
      throw totalEventsError
    }

    return Response.json({
      activeJobs: activeJobs ?? 0,
      totalClients: totalClients ?? 0,
      pendingEvents: pendingEvents ?? 0,
      totalJobs: totalJobs ?? 0,
      totalEvents: totalEvents ?? 0,
    })
  } catch (error) {
    console.error("[v0] Dashboard stats error:", error)
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
