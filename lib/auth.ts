import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { cache } from "react"
import type { User } from "@supabase/supabase-js"
import { hasPermission, roleFromAppMetadata, type Permission, type Role } from "@/lib/roles"

// Authenticates the caller from the Supabase session cookies. Read-only:
// route handlers cannot refresh cookies, so setAll is a no-op — token
// refresh happens in proxy.ts, which runs before every handler.
//
// getUser() asks the auth server, so app_metadata (and the role in it) is
// current rather than whatever the session cookie was issued with. cache()
// shares the answer between the layouts of a single server render.
export const getAuthenticatedUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
})

export function getUserRole(user: User | null): Role | null {
  return user ? roleFromAppMetadata(user.app_metadata) : null
}

// Guard for API route handlers that any signed-in user may call, whatever
// their role. Returns null when the caller is authenticated, otherwise a 401
// Response to return as-is.
//
// The proxy already rejects unauthenticated /api requests; this runs again
// inside every handler so a proxy bypass (misconfigured matcher, or a header
// exploit like CVE-2025-29927) still hits a closed door.
export async function requireApiUser(): Promise<Response | null> {
  const user = await getAuthenticatedUser()

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}

type GuardResult =
  | { user: User; role: Role; response?: never }
  | { user?: never; role?: never; response: Response }

// Guard for API route handlers: 401 with no session, 403 when the caller's
// role grants none of `permissions` (a missing or unknown role grants
// nothing). On success returns the user and role for finer checks. Like
// requireApiUser, this repeats the proxy's check on purpose.
export async function requireApiPermission(...permissions: Permission[]): Promise<GuardResult> {
  const user = await getAuthenticatedUser()

  if (!user) {
    return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const role = getUserRole(user)

  if (!role || !permissions.some((permission) => hasPermission(role, permission))) {
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { user, role }
}
