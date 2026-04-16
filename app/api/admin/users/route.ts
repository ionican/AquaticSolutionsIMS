import { NextRequest } from "next/server"
import { requirePermission, isUser } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import type { Role } from "@/lib/auth-types"

/** GET: List all users with their roles. */
export async function GET() {
  const auth = await requirePermission("users:manage")
  if (!isUser(auth)) return auth

  const admin = getSupabaseAdmin()

  // Fetch all users from auth.users via admin API
  const { data: authData, error: authError } = await admin.auth.admin.listUsers()
  if (authError) {
    return Response.json({ error: authError.message }, { status: 500 })
  }

  // Fetch all roles
  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id, role")

  const roleMap = new Map(
    (roles || []).map((r: { user_id: string; role: string }) => [r.user_id, r.role])
  )

  const users = authData.users.map((u) => ({
    id: u.id,
    email: u.email,
    role: roleMap.get(u.id) ?? "viewer",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }))

  return Response.json({ users })
}

/** POST: Create a new user and assign a role. */
export async function POST(req: NextRequest) {
  const auth = await requirePermission("users:manage")
  if (!isUser(auth)) return auth

  const { email, role = "viewer" } = await req.json()

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 })
  }

  const validRoles: Role[] = ["viewer", "editor", "admin"]
  if (!validRoles.includes(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Create user in Supabase Auth with a random password (they'll reset it)
  const tempPassword = crypto.randomUUID()
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { role },
  })

  if (createError) {
    return Response.json({ error: createError.message }, { status: 400 })
  }

  // Assign role
  const { error: roleError } = await admin
    .from("user_roles")
    .upsert({ user_id: newUser.user.id, role, updated_at: new Date().toISOString() })

  if (roleError) {
    return Response.json({ error: roleError.message }, { status: 500 })
  }

  // Send password reset email so the user can set their own password
  await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  })

  await auditLog(auth, "create_user", "users", { new_user_email: email, role })

  return Response.json({
    success: true,
    user: {
      id: newUser.user.id,
      email: newUser.user.email,
      role,
    },
  })
}
