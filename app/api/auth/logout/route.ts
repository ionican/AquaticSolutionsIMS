import { getSupabaseServer } from "@/lib/supabase-server"

export async function POST() {
  const supabase = await getSupabaseServer()
  await supabase.auth.signOut()
  return Response.json({ success: true })
}
