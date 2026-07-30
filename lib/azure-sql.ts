export interface AzureQueryResult<T = any> {
  recordset: T[]
  rowsAffected: number[]
}

export interface AzureSqlClient {
  query<T = any>(sql: string): Promise<AzureQueryResult<T>>
  close(): Promise<void>
  via: "proxy" | "direct"
}

// Single source of truth for which path a query will take. Callers need this
// before a client exists — and on an error path, where one never will — so it
// must not be re-derived independently: a reported `via` that disagreed with
// the client would defeat the point of reporting it at all.
export function azureSqlVia(): "proxy" | "direct" {
  const proxyUrl = process.env.AZURE_SQL_PROXY_URL
  const proxyKey = process.env.AZURE_SQL_PROXY_KEY
  return proxyUrl?.trim() && proxyKey?.trim() ? "proxy" : "direct"
}

export async function connectAzureSql(): Promise<AzureSqlClient> {
  const proxyUrl = process.env.AZURE_SQL_PROXY_URL
  const proxyKey = process.env.AZURE_SQL_PROXY_KEY

  if (proxyUrl && proxyKey && azureSqlVia() === "proxy") {
    return {
      via: "proxy",
      async query<T = any>(sql: string): Promise<AzureQueryResult<T>> {
        const response = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": proxyKey,
          },
          body: JSON.stringify({ query: sql }),
        })

        let body: unknown

        try {
          body = await response.json()
        } catch {
          throw new Error(
            `Azure SQL proxy returned HTTP ${response.status} with an invalid JSON response`
          )
        }

        const proxyResponse =
          typeof body === "object" && body !== null
            ? (body as {
                success?: boolean
                recordset?: T[]
                rowsAffected?: number[]
                error?: string
              })
            : {}

        if (
          proxyResponse.success !== true &&
          typeof proxyResponse.error === "string"
        ) {
          throw new Error(proxyResponse.error)
        }

        if (!response.ok) {
          throw new Error(`Azure SQL proxy returned HTTP ${response.status}`)
        }

        if (
          proxyResponse.success !== true ||
          !Array.isArray(proxyResponse.recordset) ||
          !Array.isArray(proxyResponse.rowsAffected)
        ) {
          throw new Error("Azure SQL proxy returned an invalid response")
        }

        return {
          recordset: proxyResponse.recordset,
          rowsAffected: proxyResponse.rowsAffected,
        }
      },
      async close(): Promise<void> {},
    }
  }

  const sql = (await import("mssql")).default
  const pool = await sql.connect({
    server: process.env.AZURE_SQL_SERVER || "",
    database: process.env.AZURE_SQL_DATABASE || "",
    user: process.env.AZURE_SQL_USER || "",
    password: process.env.AZURE_SQL_PASSWORD || "",
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
  })

  return {
    via: "direct",
    async query<T = any>(sql: string): Promise<AzureQueryResult<T>> {
      const result = await pool.query(sql)
      return {
        recordset: result.recordset as T[],
        rowsAffected: result.rowsAffected as number[],
      }
    },
    async close(): Promise<void> {
      await pool.close()
    },
  }
}
