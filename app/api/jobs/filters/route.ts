import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { requireApiPermission } from "@/lib/auth"

export async function GET() {
  const guard = await requireApiPermission("jobs.view")
  if (guard.response) return guard.response

  const supabase = createSupabaseAdminClient()

  const [statusRes, jobTypesRes, jobClassesRes] = await Promise.all([
    supabase.from("jobs").select("status").not("status", "is", null).order("status"),
    supabase.from("job_types").select("job_type_id, job_type").order("job_type"),
    supabase.from("job_classes").select("job_class_id, job_class").order("job_class"),
  ])

  // Get distinct statuses
  const statuses = [...new Set((statusRes.data || []).map((r: { status: string }) => r.status))].filter(Boolean).sort()

  return Response.json({
    statuses,
    jobTypes: jobTypesRes.data || [],
    jobClasses: jobClassesRes.data || [],
  })
}
