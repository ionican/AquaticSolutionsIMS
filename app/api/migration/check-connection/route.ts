import { NextResponse } from "next/server"

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

  const configured = !!(server && database && user && password)

  if (!configured) {
    return NextResponse.json({ configured: false })
  }

  // If configured, try to connect and list tables
  try {
    const sql = await import("mssql")
    
    const config: sql.config = {
      server: server!,
      database: database!,
      user: user!,
      password: password!,
      options: {
        encrypt: true,
        trustServerCertificate: false,
      },
    }

    const pool = await sql.connect(config)
    
    // Get list of user tables
    const result = await pool.query`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `
    
    await pool.close()

    const tables = result.recordset.map((row: { TABLE_NAME: string }) => row.TABLE_NAME)

    return NextResponse.json({ configured: true, tables, serverIp })
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
      serverIp
    })
  }
}
