import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"
import { getUserRole, requireApiPermission } from "@/lib/auth"
import { parseRole, roleLabel } from "@/lib/roles"

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

// Admins across every page of auth users. The org is small, but page anyway so
// the zero-admins guard can never undercount.
async function countAdmins(supabase: AdminClient): Promise<number> {
  const perPage = 1000
  let count = 0
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    count += users.filter((user) => getUserRole(user) === "admin").length
    if (users.length < perPage) return count
  }
}

// Change a user's role. Admin only; the role lives in app_metadata, which only
// the service role can write.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiPermission("users.manage")
  if (guard.response) return guard.response

  const { id } = await params
  const body = await req.json()
  const role = parseRole(body.role)

  if (!role) {
    return Response.json({ error: "Unknown role" }, { status: 400 })
  }

  // An admin changing their own role could demote themselves out of the only
  // page that can undo it.
  if (guard.user.id === id) {
    return Response.json({ error: "You cannot change your own role" }, { status: 403 })
  }

  const supabase = createSupabaseAdminClient()

  const { data: target, error: targetError } = await supabase.auth.admin.getUserById(id)

  if (targetError || !target?.user) {
    if (!targetError || targetError.code === "user_not_found" || targetError.status === 404) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }
    return Response.json({ error: targetError.message }, { status: 500 })
  }

  if (getUserRole(target.user) === "admin" && role !== "admin") {
    try {
      if ((await countAdmins(supabase)) <= 1) {
        return Response.json(
          { error: "At least one Admin is required — make someone else an Admin first" },
          { status: 409 }
        )
      }
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Could not count admins" },
        { status: 500 }
      )
    }
  }

  // Merge: app_metadata also holds the auth provider details.
  const { error } = await supabase.auth.admin.updateUserById(id, {
    app_metadata: { ...target.user.app_metadata, role },
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, role, label: roleLabel(role) })
}

// Hard delete of the auth user — removing the account is the whole point, and
// there is no app-level users table to soft-delete against.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // The guard returns the caller it authenticated: a second, separate lookup
  // for the self-delete check would fail open if it transiently returned null.
  const guard = await requireApiPermission("users.manage")
  if (guard.response) return guard.response

  const { id } = await params

  // Deleting your own account would sign you out mid-request with no way back
  // in. It also means the last Admin can never be deleted: the caller is one.
  if (guard.user.id === id) {
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
