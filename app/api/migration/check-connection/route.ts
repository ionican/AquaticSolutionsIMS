import { NextResponse } from "next/server"
import { checkConnection, isProxyConfigured } from "@/lib/azure-sql"

export async function GET() {
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
