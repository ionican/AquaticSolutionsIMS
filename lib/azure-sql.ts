/**
 * Azure SQL proxy client.
 *
 * If AZURE_SQL_PROXY_URL and AZURE_SQL_PROXY_KEY are set, queries are sent
 * to the Azure Function proxy. Otherwise falls back to direct mssql connection.
 */

interface QueryResult {
  recordset: Record<string, unknown>[]
  rowsAffected: number[]
}

const proxyUrl = () => process.env.AZURE_SQL_PROXY_URL
const proxyKey = () => process.env.AZURE_SQL_PROXY_KEY

export function isProxyConfigured(): boolean {
  return !!(proxyUrl() && proxyKey())
}

async function queryViaProxy(query: string): Promise<QueryResult> {
  const res = await fetch(proxyUrl()!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": proxyKey()!,
    },
    body: JSON.stringify({ query }),
  })

  const data = await res.json()

  if (!data.success) {
    throw new Error(data.error || "Proxy query failed")
  }

  return {
    recordset: data.recordset || [],
    rowsAffected: data.rowsAffected || [],
  }
}

async function queryDirect(query: string): Promise<QueryResult> {
  const sql = await import("mssql")

  const config: import("mssql").config = {
    server: process.env.AZURE_SQL_SERVER || "",
    database: process.env.AZURE_SQL_DATABASE || "",
    user: process.env.AZURE_SQL_USER || "",
    password: process.env.AZURE_SQL_PASSWORD || "",
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
  }

  const pool = await sql.default.connect(config)
  const result = await pool.request().query(query)
  await pool.close()

  return {
    recordset: result.recordset || [],
    rowsAffected: result.rowsAffected || [],
  }
}

export async function azureSqlQuery(query: string): Promise<QueryResult> {
  if (isProxyConfigured()) {
    return queryViaProxy(query)
  }
  return queryDirect(query)
}

/**
 * Check if we can connect to Azure SQL (via proxy or direct).
 */
export async function checkConnection(): Promise<{ configured: boolean; error?: string; firewallBlocked?: boolean; blockedIp?: string }> {
  try {
    await azureSqlQuery("SELECT 1 AS test")
    return { configured: true }
  } catch (error: any) {
    const msg = error?.message || String(error)

    // Detect firewall block
    const ipMatch = msg.match(/Client with IP address '([^']+)' is not allowed/)
    if (ipMatch) {
      return {
        configured: false,
        firewallBlocked: true,
        blockedIp: ipMatch[1],
        error: msg,
      }
    }

    return { configured: false, error: msg }
  }
}
