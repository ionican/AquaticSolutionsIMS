import { createClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const jobId = parseInt(id)

  if (isNaN(jobId)) {
    return Response.json({ error: "Invalid job ID" }, { status: 400 })
  }

  // Fetch the job
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single()

  if (jobError || !job) {
    return Response.json({ error: "Job not found" }, { status: 404 })
  }

  // Fetch related data manually (no FK constraints)
  const [clientRes, contactRes, typeRes, classRes] = await Promise.all([
    job.client_id ? supabase.from("clients").select("*").eq("client_id", job.client_id).single() : { data: null },
    job.contact_id ? supabase.from("contacts").select("*").eq("contact_id", job.contact_id).single() : { data: null },
    job.job_type_id ? supabase.from("job_types").select("*").eq("job_type_id", job.job_type_id).single() : { data: null },
    job.job_class_id ? supabase.from("job_classes").select("*").eq("job_class_id", job.job_class_id).single() : { data: null },
  ])

  // Fetch events for this job, ordered by date
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("*")
    .eq("enquiry_id", job.enquiry_id)
    .order("date", { ascending: true })

  if (eventsError) {
    console.error("Events fetch error:", eventsError)
  }

  return Response.json({
    job: {
      ...job,
      client: clientRes.data,
      contact: contactRes.data,
      job_type: typeRes.data,
      job_class: classRes.data,
    },
    events: events || [],
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const jobId = parseInt(id)

  if (isNaN(jobId)) {
    return Response.json({ error: "Invalid job ID" }, { status: 400 })
  }

  const body = await req.json()

  const updateData: Record<string, unknown> = {}
  const fields = [
    "project_name", "site", "site_pcode", "status",
    "client_id", "contact_id", "job_type_id", "job_class_id",
    "nature", "source", "enquiry_date", "quotation_value", "notes",
  ]
  for (const field of fields) {
    if (field in body) updateData[field] = body[field]
  }

  const { data, error } = await supabase
    .from("jobs")
    .update(updateData)
    .eq("id", jobId)
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ job: data })
}
