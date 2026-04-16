import { getSupabase } from "@/lib/supabase"
import { NextRequest } from "next/server"
import { requirePermission, isUser } from "@/lib/auth"
import { auditLog } from "@/lib/audit"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("jobs:read")
  if (!isUser(auth)) return auth

  const { id } = await params
  const jobId = parseInt(id)

  if (isNaN(jobId)) {
    return Response.json({ error: "Invalid job ID" }, { status: 400 })
  }

  const supabase = getSupabase()

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
  const [clientRes, typeRes, classRes] = await Promise.all([
    job.client_id ? supabase.from("clients").select("*").eq("client_id", job.client_id).single() : { data: null },
    job.job_type_id ? supabase.from("job_types").select("*").eq("job_type_id", job.job_type_id).single() : { data: null },
    job.job_class_id ? supabase.from("job_classes").select("*").eq("job_class_id", job.job_class_id).single() : { data: null },
  ])

  // Fetch job contacts via the jobcontacts junction table
  const { data: jobContacts } = await supabase
    .from("jobcontacts")
    .select("id, enquiry_id, contact_id, title, invoice, jobsheet")
    .eq("enquiry_id", job.enquiry_id)
    .order("id")

  // Resolve contact details for each jobcontact
  const contactIds = [...new Set((jobContacts || []).map(jc => jc.contact_id).filter(Boolean))]
  let contactMap: Record<number, unknown> = {}
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("contact_id, fname, sname, tel, mobile, email, title")
      .in("contact_id", contactIds)
    contactMap = Object.fromEntries(
      (contacts || []).map((c: { contact_id: number }) => [c.contact_id, c])
    )
  }

  const resolvedJobContacts = (jobContacts || []).map(jc => ({
    ...jc,
    contact: contactMap[jc.contact_id] ?? null,
  }))

  // Fetch events for this job, ordered by date
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("*")
    .eq("enquiry_id", job.enquiry_id)
    .order("date", { ascending: true })

  if (eventsError) {
    console.error("Events fetch error:", eventsError)
  }

  await auditLog(auth, "read", "jobs", { job_id: jobId })

  return Response.json({
    job: {
      ...job,
      client: clientRes.data,
      job_type: typeRes.data,
      job_class: classRes.data,
    },
    jobContacts: resolvedJobContacts,
    events: events || [],
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("jobs:write")
  if (!isUser(auth)) return auth

  const { id } = await params
  const jobId = parseInt(id)

  if (isNaN(jobId)) {
    return Response.json({ error: "Invalid job ID" }, { status: 400 })
  }

  const supabase = getSupabase()
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

  // Sync jobcontacts if provided
  if (body.jobContacts && Array.isArray(body.jobContacts)) {
    const enquiryId = data.enquiry_id

    // Delete existing jobcontacts for this job
    await supabase
      .from("jobcontacts")
      .delete()
      .eq("enquiry_id", enquiryId)

    // Insert new ones
    if (body.jobContacts.length > 0) {
      const { data: maxJc } = await supabase
        .from("jobcontacts")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .single()

      let nextJcId = (maxJc?.id || 0) + 1

      const jcRows = body.jobContacts.map((jc: { contact_id: number; title: string; jobsheet?: boolean; invoice?: boolean }) => ({
        id: nextJcId++,
        enquiry_id: enquiryId,
        contact_id: jc.contact_id,
        title: jc.title || "Client Contact",
        jobsheet: jc.jobsheet ?? true,
        invoice: jc.invoice ?? null,
        company_id: null,
      }))

      const { error: jcError } = await supabase
        .from("jobcontacts")
        .insert(jcRows)

      if (jcError) {
        console.error("[v0] Error syncing jobcontacts:", jcError)
      }
    }
  }

  await auditLog(auth, "update", "jobs", { job_id: jobId, fields: Object.keys(updateData) })

  return Response.json({ job: data })
}
