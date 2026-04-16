import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase-server"
import { type Role, type Permission, ROLE_PERMISSIONS } from "@/lib/auth-types"
import { auditLog } from "@/lib/audit"

export interface AuthUser {
  id: string
  email: string
  role: Role
  permissions: Permission[]
}

/**
 * Authenticate the current request and return the user with resolved
 * permissions. Returns null if no valid session.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await getSupabaseServer()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  const admin = getSupabaseAdmin()

  // Fetch role
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  const role: Role = roleRow?.role ?? "viewer"

  // Fetch per-user overrides
  const { data: overrides } = await admin
    .from("user_permissions")
    .select("permission, granted")
    .eq("user_id", user.id)

  // Start with role defaults, then apply overrides
  const permSet = new Set<Permission>(ROLE_PERMISSIONS[role])

  for (const o of overrides || []) {
    if (o.granted) {
      permSet.add(o.permission as Permission)
    } else {
      permSet.delete(o.permission as Permission)
    }
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role,
    permissions: [...permSet],
  }
}

/**
 * Require a valid authenticated user. Returns a 401 Response if not
 * authenticated.
 */
export async function requireAuth(): Promise<AuthUser | Response> {
  const user = await getAuthUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  return user
}

/**
 * Require a specific role (or higher). Returns a 403 Response if the user
 * doesn't have the required role.
 */
export async function requireRole(
  minimumRole: Role
): Promise<AuthUser | Response> {
  const result = await requireAuth()
  if (result instanceof Response) return result

  const hierarchy: Role[] = ["viewer", "editor", "admin"]
  const userLevel = hierarchy.indexOf(result.role)
  const requiredLevel = hierarchy.indexOf(minimumRole)

  if (userLevel < requiredLevel) {
    await auditLog(result, "access_denied", "auth", {
      required_role: minimumRole,
      user_role: result.role,
    })
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  return result
}

/**
 * Require a specific permission. Returns a 403 Response if the user
 * doesn't have it (after applying role defaults + per-user overrides).
 */
export async function requirePermission(
  permission: Permission
): Promise<AuthUser | Response> {
  const result = await requireAuth()
  if (result instanceof Response) return result

  if (!result.permissions.includes(permission)) {
    await auditLog(result, "access_denied", "auth", {
      required_permission: permission,
    })
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  return result
}

/** Helper to check if a requireAuth/requireRole/requirePermission result is a user. */
export function isUser(result: AuthUser | Response): result is AuthUser {
  return !(result instanceof Response)
}
