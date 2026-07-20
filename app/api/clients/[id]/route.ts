import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"

// Fields the management UI is allowed to edit. `id`/`client_id` are immutable.
const EDITABLE_FIELDS = [
  "business_name",
  "address1",
  "address2",
  "town",
  "county",
  "pcode",
  "web_site",
  "active",
] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseAdminClient()
  const { id } = await params
  const clientId = parseInt(id)

  if (isNaN(clientId)) {
    return Response.json({ error: "Invalid client ID" }, { status: 400 })
  }

  const body = await req.json()

  const updateData: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updateData[field] = body[field]
  }

  if ("business_name" in updateData && !String(updateData.business_name || "").trim()) {
    return Response.json({ error: "Client name is required" }, { status: 400 })
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "No changes provided" }, { status: 400 })
  }

  updateData.updateddateutc = new Date().toISOString()

  const { data, error } = await supabase
    .from("clients")
    .update(updateData)
    .eq("client_id", clientId)
    .select("client_id, business_name, address1, address2, town, county, pcode, web_site, active")
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ client: data })
}

// Soft delete — flip the text `active` flag to "n". No hard delete: with no FK
// constraints, jobs referencing this client_id would otherwise be orphaned.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseAdminClient()
  const { id } = await params
  const clientId = parseInt(id)

  if (isNaN(clientId)) {
    return Response.json({ error: "Invalid client ID" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("clients")
    .update({ active: "n", updateddateutc: new Date().toISOString() })
    .eq("client_id", clientId)
    .select("client_id, business_name, active")
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ client: data })
}
