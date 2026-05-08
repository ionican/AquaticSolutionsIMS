import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"

export async function GET() {
  const supabase = createSupabaseAdminClient()

  const [clientsRes, contactsRes] = await Promise.all([
    supabase.from("clients").select("client_id, business_name").order("business_name"),
    supabase.from("contacts").select("contact_id, client_id"),
  ])

  if (clientsRes.error) {
    return Response.json({ error: clientsRes.error.message }, { status: 500 })
  }

  // Build contact count map
  const countMap: Record<number, number> = {}
  for (const c of contactsRes.data || []) {
    if (c.client_id) countMap[c.client_id] = (countMap[c.client_id] || 0) + 1
  }

  const clients = (clientsRes.data || []).map(c => ({
    ...c,
    contact_count: countMap[c.client_id] || 0,
  }))

  return Response.json({ clients })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await req.json()
    const businessName = String(body.business_name || "").trim()

    if (!businessName) {
      return Response.json({ error: "Client name is required" }, { status: 400 })
    }

    const { data: maxClient, error: maxClientError } = await supabase
      .from("clients")
      .select("client_id")
      .order("client_id", { ascending: false })
      .limit(1)
      .single()

    if (maxClientError) {
      return Response.json({ error: maxClientError.message }, { status: 500 })
    }

    const nextClientId = (maxClient?.client_id || 0) + 1

    const { data, error } = await supabase
      .from("clients")
      .insert({
        id: nextClientId,
        client_id: nextClientId,
        business_name: businessName,
        company_id: 6,
        active: "y",
        updateddateutc: new Date().toISOString(),
      })
      .select("client_id, business_name")
      .single()

    if (error) {
      console.error("[v0] Error creating client:", error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ client: { ...data, contact_count: 0 } })
  } catch (error) {
    console.error("[v0] Error in clients API:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create client" },
      { status: 500 }
    )
  }
}
