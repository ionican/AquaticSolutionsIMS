import { NextRequest } from "next/server"
import { requirePermission, isUser } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import type { Role, Permission } from "@/lib/auth-types"

/** PATCH: Update a user's role or permissions. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("users:manage")
  if (!isUser(auth)) return auth

  const { id: userId } = await params
  const body = await req.json()
  const admin = getSupabaseAdmin()

  // Update role if provided
  if (body.role) {
    const validRoles: Role[] = ["viewer", "editor", "admin"]
    if (!validRoles.includes(body.role)) {
      return Response.json({ error: "Invalid role" }, { status: 400 })
    }

    const { error: roleError } = await admin
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: body.role,
        updated_at: new Date().toISOString(),
      })

    if (roleError) {
      return Response.json({ error: roleError.message }, { status: 500 })
    }

    // Also update user_metadata for middleware performance
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { role: body.role },
    })

    await auditLog(auth, "update_role", "users", {
      target_user: userId,
      new_role: body.role,
    })
  }

  // Update permission overrides if provided
  if (body.permissions && Array.isArray(body.permissions)) {
    // Clear existing overrides then insert new ones
    await admin.from("user_permissions").delete().eq("user_id", userId)

    if (body.permissions.length > 0) {
      const rows = body.permissions.map(
        (p: { permission: Permission; granted: boolean }) => ({
          user_id: userId,
          permission: p.permission,
          granted: p.granted,
        })
      )

      const { error: permError } = await admin
        .from("user_permissions")
        .insert(rows)

      if (permError) {
        return Response.json({ error: permError.message }, { status: 500 })
      }
    }

    await auditLog(auth, "update_permissions", "users", {
      target_user: userId,
      overrides: body.permissions,
    })
  }

  return Response.json({ success: true })
}

/** DELETE: Remove a user. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("users:manage")
  if (!isUser(auth)) return auth

  const { id: userId } = await params

  // Don't let admins delete themselves
  if (userId === auth.id) {
    return Response.json({ error: "Cannot delete your own account" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Clean up role and permissions (cascade should handle this, but be explicit)
  await admin.from("user_roles").delete().eq("user_id", userId)
  await admin.from("user_permissions").delete().eq("user_id", userId)

  // Delete from auth
  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await auditLog(auth, "delete_user", "users", { deleted_user: userId })

  return Response.json({ success: true })
}
