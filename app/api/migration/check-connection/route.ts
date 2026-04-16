import { NextResponse } from "next/server"
import { checkConnection, isProxyConfigured } from "@/lib/azure-sql"
import { requirePermission, isUser } from "@/lib/auth"

export async function GET() {
  const auth = await requirePermission("migration:run")
  if (!isUser(auth)) return auth

  const hasProxy = isProxyConfigured()
  const hasDirect = !!(
    process.env.AZURE_SQL_SERVER &&
    process.env.AZURE_SQL_DATABASE &&
    process.env.AZURE_SQL_USER &&
    process.env.AZURE_SQL_PASSWORD
  )

  if (!hasProxy && !hasDirect) {
    return NextResponse.json({ configured: false })
  }

  const result = await checkConnection()

  if (result.configured) {
    return NextResponse.json({ configured: true, usingProxy: hasProxy })
  }

  return NextResponse.json({
    configured: false,
    error: result.error,
    blockedIp: result.blockedIp,
    firewallBlocked: result.firewallBlocked,
  })
}
