import { getSupabase } from "@/lib/supabase"
import { NextRequest } from "next/server"
import { requirePermission, isUser } from "@/lib/auth"
import { auditLog } from "@/lib/audit"

/** GET: Fetch jobcontacts for a given enquiry_id, with resolved contact details. */
export async function GET(req: NextRequest) {
  const auth = await requirePermission("jobs:read")
  if (!isUser(auth)) return auth

  const { searchParams } = new URL(req.url)
  const enquiryId = searchParams.get("enquiry_id")

  if (!enquiryId) {
    return Response.json({ error: "enquiry_id is required" }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data: jobContacts, error } = await supabase
    .from("jobcontacts")
    .select("id, enquiry_id, contact_id, title, invoice, jobsheet")
    .eq("enquiry_id", parseInt(enquiryId))
    .order("id")

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Resolve contact details
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

  const data = (jobContacts || []).map(jc => ({
    ...jc,
    contact: contactMap[jc.contact_id] ?? null,
  }))

  return Response.json({ jobContacts: data })
}

/** POST: Add a contact to a job. */
export async function POST(req: NextRequest) {
  const auth = await requirePermission("jobs:write")
  if (!isUser(auth)) return auth

  const body = await req.json()
  const { enquiry_id, contact_id, title, invoice, jobsheet } = body

  if (!enquiry_id || !contact_id) {
    return Response.json({ error: "enquiry_id and contact_id are required" }, { status: 400 })
  }

  const supabase = getSupabase()

  // Get the next id
  const { data: maxRow } = await supabase
    .from("jobcontacts")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .single()

  const nextId = (maxRow?.id || 0) + 1

  const { data, error } = await supabase
    .from("jobcontacts")
    .insert({
      id: nextId,
      enquiry_id,
      contact_id,
      title: title || "Client Contact",
      invoice: invoice ?? null,
      jobsheet: jobsheet ?? true,
      company_id: null,
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await auditLog(auth, "add_contact", "jobcontacts", { enquiry_id, contact_id, title })

  return Response.json({ success: true, jobContact: data })
}

/** DELETE: Remove a contact from a job. */
export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("jobs:write")
  if (!isUser(auth)) return auth

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 })
  }

  const supabase = getSupabase()

  // Fetch before delete for audit
  const { data: existing } = await supabase
    .from("jobcontacts")
    .select("enquiry_id, contact_id")
    .eq("id", parseInt(id))
    .single()

  const { error } = await supabase
    .from("jobcontacts")
    .delete()
    .eq("id", parseInt(id))

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await auditLog(auth, "remove_contact", "jobcontacts", {
    jobcontact_id: id,
    enquiry_id: existing?.enquiry_id,
    contact_id: existing?.contact_id,
  })

  return Response.json({ success: true })
}
