import { getSupabase } from "@/lib/supabase"
import { requirePermission, isUser } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { checkRateLimit } from "@/lib/rate-limit"

export async function GET() {
  const auth = await requirePermission("clients:read")
  if (!isUser(auth)) return auth

  const rateErr = checkRateLimit(auth.id, "GET", "/api/clients", 10, 60)
  if (rateErr) return rateErr

  const supabase = getSupabase()
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

  await auditLog(auth, "list", "clients", { count: clients.length })

  return Response.json({ clients })
}
