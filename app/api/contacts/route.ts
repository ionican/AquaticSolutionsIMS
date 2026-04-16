import { getSupabase } from "@/lib/supabase"
import { NextRequest } from "next/server"
import { requirePermission, isUser } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { checkRateLimit } from "@/lib/rate-limit"

export async function GET(req: NextRequest) {
  const auth = await requirePermission("contacts:read")
  if (!isUser(auth)) return auth

  const rateErr = checkRateLimit(auth.id, "GET", "/api/contacts", 10, 60)
  if (rateErr) return rateErr

  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get("client_id")

  let query = supabase
    .from("contacts")
    .select("contact_id, fname, sname, client_id")
    .order("sname")

  if (clientId) {
    query = query.eq("client_id", parseInt(clientId))
  }

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await auditLog(auth, "list", "contacts", { client_id: clientId, count: data?.length ?? 0 })

  return Response.json({ contacts: data || [] })
}
