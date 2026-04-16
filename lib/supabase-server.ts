import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Server-side Supabase client that reads the session cookie.
 * Call this in API routes, server components, and middleware.
 * Uses the anon key — the user's JWT handles authorization.
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from Server Components where cookies are read-only.
            // This is safe to ignore when the middleware refreshes the session.
          }
        },
      },
    }
  )
}

/**
 * Admin Supabase client with the service role key.
 * Only use for operations that need to bypass RLS
 * (user management, audit logging, role lookups).
 */
export function getSupabaseAdmin() {
  // Re-use the existing singleton from lib/supabase.ts
  const { getSupabase } = require("@/lib/supabase")
  return getSupabase()
}
