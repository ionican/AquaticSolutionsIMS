import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"

interface JobContactInput {
  contact_id?: string | number | null
  title?: string | null
  invoice?: boolean | null
  jobsheet?: boolean | null
  prenotification?: boolean | null
}

function buildJobContactRows(jobContacts: unknown, enquiryId: number) {
  if (!Array.isArray(jobContacts)) return []

  return jobContacts
    .map((jobContact: JobContactInput) => {
      const contactId = jobContact.contact_id ? parseInt(String(jobContact.contact_id)) : NaN
      if (Number.isNaN(contactId)) return null

      return {
        company_id: 6,
        enquiry_id: enquiryId,
        contact_id: contactId,
        title: jobContact.title || null,
        invoice: jobContact.invoice === true,
        jobsheet: jobContact.jobsheet === true,
        prenotification: jobContact.prenotification === true,
      }
    })
    .filter((jobContact): jobContact is NonNullable<typeof jobContact> => jobContact !== null)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseAdminClient()
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

  const { data: jobContacts, error: jobContactsError } = await supabase
    .from("jobcontacts")
    .select("id, company_id, enquiry_id, contact_id, title, invoice, jobsheet, prenotification")
    .eq("enquiry_id", job.enquiry_id)
    .order("id", { ascending: true })

  if (jobContactsError) {
    console.error("Job contacts fetch error:", jobContactsError)
  }

  const jobContactIds = [
    ...new Set((jobContacts || []).map((jobContact) => jobContact.contact_id).filter(Boolean)),
  ]

  const { data: linkedContacts, error: linkedContactsError } = jobContactIds.length
    ? await supabase.from("contacts").select("*").in("contact_id", jobContactIds)
    : { data: [], error: null }

  if (linkedContactsError) {
    console.error("Linked contacts fetch error:", linkedContactsError)
  }

  const contactsById = new Map(
    (linkedContacts || []).map((contact) => [contact.contact_id, contact])
  )

  const resolvedJobContacts = (jobContacts || []).map((jobContact) => ({
    ...jobContact,
    contact: contactsById.get(jobContact.contact_id) ?? null,
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

  return Response.json({
    job: {
      ...job,
      client: clientRes.data,
      contact: contactRes.data,
      jobContacts: resolvedJobContacts,
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
  const supabase = createSupabaseAdminClient()
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

  if (Array.isArray(body.jobContacts)) {
    const { error: deleteJobContactsError } = await supabase
      .from("jobcontacts")
      .delete()
      .eq("enquiry_id", data.enquiry_id)

    if (deleteJobContactsError) {
      return Response.json({ error: deleteJobContactsError.message }, { status: 500 })
    }

    const jobContactRows = buildJobContactRows(body.jobContacts, data.enquiry_id)

    if (jobContactRows.length > 0) {
      const { error: insertJobContactsError } = await supabase
        .from("jobcontacts")
        .insert(jobContactRows)

      if (insertJobContactsError) {
        return Response.json({ error: insertJobContactsError.message }, { status: 500 })
      }
    }
  }

  return Response.json({ job: data })
}
