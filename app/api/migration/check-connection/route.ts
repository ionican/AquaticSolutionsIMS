import { NextResponse } from "next/server"
import { azureSqlVia, connectAzureSql } from "@/lib/azure-sql"

async function getServerIp() {
  try {
    const response = await fetch("https://api.ipify.org?format=json")
    const data = await response.json()
    return data.ip
  } catch {
    return null
  }
}

export async function GET() {
  const server = process.env.AZURE_SQL_SERVER
  const database = process.env.AZURE_SQL_DATABASE
  const user = process.env.AZURE_SQL_USER
  const password = process.env.AZURE_SQL_PASSWORD
  const serverIp = await getServerIp()
  const via = azureSqlVia()

  // Either transport is sufficient. A proxy-only deployment is valid: the
  // Function holds the SQL credentials, so the four direct vars need not be set
  // here. Checking only those would report an unusable "not configured" while
  // azureSqlVia() was already selecting a working proxy.
  const configured = via === "proxy" || !!(server && database && user && password)

  if (!configured) {
    return NextResponse.json({ configured: false, via })
  }

  // If configured, try to connect and list tables
  try {
    const client = await connectAzureSql()
    
    // Get list of user tables
    const result = await client.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `)
    
    await client.close()

    const tables = result.recordset.map((row: { TABLE_NAME: string }) => row.TABLE_NAME)

    return NextResponse.json({ configured: true, tables, serverIp, via: client.via })
  } catch (error) {
    console.error("Azure SQL connection error:", error)
    const message = error instanceof Error ? error.message : "Connection failed"
    
    // Extract blocked IP address from Azure SQL firewall error message
    const ipMatch = message.match(/Client with IP address '([\d.]+)'/)
    const blockedIp = ipMatch ? ipMatch[1] : null

    return NextResponse.json({ 
      configured: true, 
      error: message,
      blockedIp,
      firewallBlocked: blockedIp !== null,
      server,
      database,
      user,
      serverIp,
      via
    })
  }
}
