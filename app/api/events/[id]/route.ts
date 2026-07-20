import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { coerceEventFields } from "@/lib/event-fields"
import { NextRequest } from "next/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
