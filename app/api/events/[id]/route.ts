import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { coerceEventFields } from "@/lib/event-fields"
import { NextRequest } from "next/server"
import { requireApiPermission } from "@/lib/auth"
import { canWriteEventField, checkEventUpdate } from "@/lib/roles"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Finance edits only the money fields and a Project Manager only the rest;
  // checkEventUpdate below enforces the split against the stored row.
  const guard = await requireApiPermission("jobs.edit", "events.money.edit")
  if (guard.response) return guard.response

  const supabase = createSupabaseAdminClient()
  const { id } = await params
  const eventId = parseInt(id)

  if (isNaN(eventId)) {
    return Response.json({ error: "Invalid event ID" }, { status: 400 })
  }

  const body = await req.json()
  const coerced = coerceEventFields(body)
  if ("error" in coerced) {
    return Response.json({ error: coerced.error }, { status: 400 })
  }

  const updateData = coerced.data
  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "No changes provided" }, { status: 400 })
  }

  // Compare against the stored row rather than the request alone: the edit
  // form sends every field back, unchanged ones included.
  const { data: stored, error: storedError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("company_id", 6)
    .maybeSingle()

  if (storedError) {
    return Response.json({ error: storedError.message }, { status: 500 })
  }

  if (!stored) {
    return Response.json({ error: "Event not found" }, { status: 404 })
  }

  const allowed = checkEventUpdate(guard.role, updateData, stored)
  if (!allowed.ok) {
    return Response.json({ error: allowed.error }, { status: 403 })
  }

  // Fields this role may not write were only echoed back unchanged. Leave them
  // out of the update so a concurrent edit by a role that may write them is
  // not reverted to the value this form loaded.
  for (const field of Object.keys(updateData)) {
    if (!canWriteEventField(guard.role, field)) delete updateData[field]
  }

  updateData.updateddateutc = new Date().toISOString()

  // Match on the identity column, scoped to company 6 (the only tenant in this
  // system) so an event from another company can never be edited through here.
  const { data, error } = await supabase
    .from("events")
    .update(updateData)
    .eq("id", eventId)
    .eq("company_id", 6)
    .select("*")
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return Response.json({ error: "Event not found" }, { status: 404 })
  }

  return Response.json({ event: data })
}

// Hard delete. Events are a leaf table — no other table references them (they
// point at a job via enquiry_id, not the reverse), so removing one orphans
// nothing. Scoped to company 6 as a safety net.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiPermission("jobs.edit")
  if (guard.response) return guard.response

  const supabase = createSupabaseAdminClient()
  const { id } = await params
  const eventId = parseInt(id)

  if (isNaN(eventId)) {
    return Response.json({ error: "Invalid event ID" }, { status: 400 })
  }

  const { error, count } = await supabase
    .from("events")
    .delete({ count: "exact" })
    .eq("id", eventId)
    .eq("company_id", 6)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!count) {
    return Response.json({ error: "Event not found" }, { status: 404 })
  }

  return Response.json({ success: true })
}
