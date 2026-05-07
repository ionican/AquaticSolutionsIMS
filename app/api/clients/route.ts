import { createClient } from "@supabase/supabase-js"

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
