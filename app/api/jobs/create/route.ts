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

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await req.json()

    // Get the next enquiry_id
    const { data: maxEnquiry } = await supabase
      .from("jobs")
      .select("enquiry_id")
      .order("enquiry_id", { ascending: false })
      .limit(1)
      .single()

    const nextEnquiryId = (maxEnquiry?.enquiry_id || 0) + 1

    // Prepare job data with required fields
    const jobData = {
      enquiry_id: nextEnquiryId,
      project_name: body.project_name || null,
      site: body.site || null,
      site_pcode: body.site_pcode || null,
      status: body.status || "Contact",
      client_id: body.client_id ? parseInt(body.client_id) : null,
      contact_id: body.contact_id ? parseInt(body.contact_id) : null,
      job_type_id: body.job_type_id ? parseInt(body.job_type_id) : null,
      job_class_id: body.job_class_id ? parseInt(body.job_class_id) : null,
      nature: body.nature || null,
      source: body.source || null,
      enquiry_date: body.enquiry_date || new Date().toISOString(),
      quotation_value: body.quotation_value ? parseFloat(body.quotation_value) : null,
      notes: body.notes || null,
      company_id: 6, // Fixed company_id as per import rules
      updateddateutc: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("jobs")
      .insert(jobData)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating job:", error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    const jobContactRows = buildJobContactRows(body.jobContacts, data.enquiry_id)

    if (jobContactRows.length > 0) {
      const { error: jobContactsError } = await supabase
        .from("jobcontacts")
        .insert(jobContactRows)

      if (jobContactsError) {
        console.error("[v0] Error creating job contacts:", jobContactsError)
        await supabase.from("jobs").delete().eq("id", data.id)
        return Response.json({ error: jobContactsError.message }, { status: 500 })
      }
    }

    return Response.json({ success: true, job: data })
  } catch (error) {
    console.error("[v0] Error in create job API:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create job" },
      { status: 500 }
    )
  }
}
