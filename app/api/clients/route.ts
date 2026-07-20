import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { fetchAllPages } from "@/lib/supabase-pagination"
import { NextRequest } from "next/server"

interface Client {
  client_id: number
  business_name: string
  address1: string | null
  address2: string | null
  town: string | null
  county: string | null
  pcode: string | null
  web_site: string | null
  active: string | null
}

interface ContactReference {
  contact_id: number
  client_id: number
}

// status filter: "active" (default) hides deactivated records so operational
// selectors (e.g. the New Job form) never offer them; management views pass
// "all" or "inactive" explicitly. A row counts as active unless active = "n".
type StatusFilter = "active" | "inactive" | "all"

function resolveStatus(req: NextRequest): StatusFilter {
  const status = new URL(req.url).searchParams.get("status")
  return status === "all" || status === "inactive" ? status : "active"
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdminClient()
  const status = resolveStatus(req)

  const [clientsRes, contactsRes] = await Promise.all([
    fetchAllPages<Client>((from, to) => {
      let query = supabase
        .from("clients")
        .select("client_id, business_name, address1, address2, town, county, pcode, web_site, active")
        .order("business_name")
        .order("client_id")
      if (status === "active") query = query.or("active.is.null,active.neq.n")
      else if (status === "inactive") query = query.eq("active", "n")
      return query.range(from, to)
    }),
    fetchAllPages<ContactReference>((from, to) =>
      supabase
        .from("contacts")
        .select("contact_id, client_id")
        .order("contact_id")
        .range(from, to)
    ),
  ])

  if (clientsRes.error) {
    return Response.json({ error: clientsRes.error.message }, { status: 500 })
  }

  if (contactsRes.error) {
    return Response.json({ error: contactsRes.error.message }, { status: 500 })
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
        address1: body.address1 || null,
        address2: body.address2 || null,
        town: body.town || null,
        county: body.county || null,
        pcode: body.pcode || null,
        web_site: body.web_site || null,
        company_id: 6,
        active: "y",
        updateddateutc: new Date().toISOString(),
      })
      .select("client_id, business_name, address1, address2, town, county, pcode, web_site, active")
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
