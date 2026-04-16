import { getSupabaseAdmin } from "@/lib/supabase-server"
import { headers } from "next/headers"
import type { AuthUser } from "@/lib/auth"

/**
 * Log an action to the user_audit_log table.
 * Non-blocking — errors are swallowed so audit failures never break requests.
 */
export async function auditLog(
  user: AuthUser | null,
  action: string,
  resource: string,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    const hdrs = await headers()
    const ip =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      hdrs.get("x-real-ip") ??
      "unknown"

    const admin = getSupabaseAdmin()
    await admin.from("user_audit_log").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action,
      resource,
      detail: detail ?? null,
      ip_address: ip,
    })
  } catch (err) {
    // Never let audit logging break the actual request
    console.error("[audit] Failed to write audit log:", err)
  }
}
