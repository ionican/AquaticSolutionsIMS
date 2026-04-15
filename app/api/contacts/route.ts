import { createClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
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

  return Response.json({ contacts: data || [] })
}
