import { createBrowserClient } from "@supabase/ssr"

// Browser-side client for auth only (login/logout). Stores the session in
// cookies so proxy.ts and route handlers can read it. Data access stays
// server-side through /api routes.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Implicit, not PKCE: password-reset/invite emails are often opened on
        // a different device than the one that requested them, and PKCE's
        // code verifier only exists in the requesting browser. We have no
        // OAuth providers, so PKCE buys nothing here.
        flowType: "implicit",
      },
    }
  )
}
