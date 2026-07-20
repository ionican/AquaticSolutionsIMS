import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"

// Fields the management UI is allowed to edit. `contact_id` is immutable.
const EDITABLE_FIELDS = [
  "title",
  "fname",
  "sname",
  "email",
  "tel",
  "mobile",
  "client_id",
  "active",
] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseAdminClient()
  const { id } = await params
  const contactId = parseInt(id)

  if (isNaN(contactId)) {
    return Response.json({ error: "Invalid contact ID" }, { status: 400 })
  }

  const body = await req.json()

  const updateData: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updateData[field] = body[field]
  }

  if ("client_id" in updateData) {
    const parsedClientId = parseInt(String(updateData.client_id))
    if (Number.isNaN(parsedClientId)) {
      return Response.json({ error: "A valid client is required" }, { status: 400 })
    }
    updateData.client_id = parsedClientId
  }

  // Only reject when both name fields are being set and both are empty. A
  // partial update that clears just one field must not be judged against the
  // absent field (which would falsely read as empty).
  if ("fname" in updateData && "sname" in updateData && !updateData.fname && !updateData.sname) {
    return Response.json({ error: "Enter a first name or surname" }, { status: 400 })
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "No changes provided" }, { status: 400 })
  }

  updateData.updateddateutc = new Date().toISOString()

  const { data, error } = await supabase
    .from("contacts")
    .update(updateData)
    .eq("contact_id", contactId)
    .select("contact_id, fname, sname, client_id, title, tel, mobile, email, active")
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ contact: data })
}

// Soft delete — flip the text `active` flag to "n". No hard delete: with no FK
// constraints, jobs/jobcontacts referencing this contact would otherwise be orphaned.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseAdminClient()
  const { id } = await params
  const contactId = parseInt(id)

  if (isNaN(contactId)) {
    return Response.json({ error: "Invalid contact ID" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("contacts")
    .update({ active: "n", updateddateutc: new Date().toISOString() })
    .eq("contact_id", contactId)
    .select("contact_id, fname, sname, active")
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ contact: data })
}
