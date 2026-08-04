import { createBrowserClient } from "@supabase/ssr"

// Browser-side client for auth only (login/logout). Stores the session in
// cookies so proxy.ts and route handlers can read it. Data access stays
// server-side through /api routes.
export function createSupabaseBrowserClient() {
  // NB: createBrowserClient force-overrides flowType to "pkce" AFTER spreading
  // caller options (seen in @supabase/ssr 0.12.4 source), so passing
  // { auth: { flowType: "implicit" } } here does nothing — that silent override
  // is what broke Tom's first password reset (2026-08-04): the PKCE code
  // verifier only exists in the browser that requested the email, so the
  // ?code= link failed on any other device. Cross-device email links therefore
  // MUST use the token_hash form: the Supabase email templates (dashboard →
  // Authentication → Emails) link to
  //   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery|invite
  // which /auth/confirm redeems via verifyOtp — no verifier involved.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
