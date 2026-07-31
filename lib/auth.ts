import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { User } from "@supabase/supabase-js"

// Authenticates the caller from the Supabase session cookies. Read-only:
// route handlers cannot refresh cookies, so setAll is a no-op — token
// refresh happens in proxy.ts, which runs before every handler.
export async function getAuthenticatedUser(): Promise<User | null> {
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
}

// Guard for API route handlers. Returns null when the caller is
// authenticated, otherwise a 401 Response to return as-is.
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
