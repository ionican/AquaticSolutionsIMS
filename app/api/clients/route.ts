import { supabase } from "@/lib/supabase-server"

export async function GET() {
  try {
    const [clientsRes, contactsRes] = await Promise.all([
      supabase.from("clients").select("client_id, business_name").order("business_name"),
      supabase.from("contacts").select("contact_id, client_id"),
    ])

    if (clientsRes.error) {
      console.error("[v0] Clients query error:", clientsRes.error)
      return Response.json({ error: clientsRes.error.message }, { status: 500 })
    }

    if (contactsRes.error) {
      console.error("[v0] Contacts query error:", contactsRes.error)
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
  } catch (error) {
    console.error("[v0] Clients route error:", error)
    return Response.json({ error: "Failed to fetch clients" }, { status: 500 })
  }
}
