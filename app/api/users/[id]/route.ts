import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth"

// Hard delete of the auth user — removing the account is the whole point, and
// there is no app-level users table to soft-delete against.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate once and keep the user: a separate requireApiUser() +
  // getAuthenticatedUser() pair would fail open on the self-delete check if
  // the second lookup transiently returned null.
  const caller = await getAuthenticatedUser()
  if (!caller) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Blocked because every authenticated user can reach /admin: deleting your
  // own account would sign you out mid-request with no way back in.
  if (caller.id === id) {
    return Response.json({ error: "You cannot delete your own account" }, { status: 403 })
  }

  const supabase = createSupabaseAdminClient()

  const { error } = await supabase.auth.admin.deleteUser(id)

  if (error) {
    if (error.code === "user_not_found" || error.status === 404) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
