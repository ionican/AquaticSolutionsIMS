import { getSupabase } from "@/lib/supabase"
import { NextRequest } from "next/server"
import { requirePermission, isUser } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  const auth = await requirePermission("jobs:write")
  if (!isUser(auth)) return auth

  const rateErr = checkRateLimit(auth.id, "POST", "/api/jobs/create", 10, 60)
  if (rateErr) return rateErr

  try {
    const supabase = getSupabase()
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

    // Create jobcontacts entries if provided
    if (body.jobContacts && Array.isArray(body.jobContacts) && body.jobContacts.length > 0) {
      // Get the next jobcontacts id
      const { data: maxJc } = await supabase
        .from("jobcontacts")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .single()

      let nextJcId = (maxJc?.id || 0) + 1

      const jcRows = body.jobContacts.map((jc: { contact_id: number; title: string; jobsheet?: boolean; invoice?: boolean }) => ({
        id: nextJcId++,
        enquiry_id: nextEnquiryId,
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
        console.error("[v0] Error creating jobcontacts:", jcError)
      }
    }

    await auditLog(auth, "create", "jobs", {
      job_id: data.id,
      enquiry_id: nextEnquiryId,
      contacts_count: body.jobContacts?.length ?? 0,
    })

    return Response.json({ success: true, job: data })
  } catch (error) {
    console.error("[v0] Error in create job API:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create job" },
      { status: 500 }
    )
  }
}
