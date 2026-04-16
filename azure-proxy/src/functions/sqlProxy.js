const { app } = require("@azure/functions");
const sql = require("mssql");

let pool = null;

async function getPool() {
  if (pool) return pool;

  pool = await sql.connect({
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
  });

  return pool;
}

app.http("sqlProxy", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    // Validate API key
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        status: 401,
        jsonBody: { success: false, error: "Invalid API key" },
      };
    }

    try {
      const body = await request.json();
      const { query } = body;

      if (!query || typeof query !== "string") {
        return {
          status: 400,
          jsonBody: { success: false, error: "query string is required" },
        };
      }

      const db = await getPool();
      const result = await db.request().query(query);

      return {
        jsonBody: {
          success: true,
          recordset: result.recordset || [],
          rowsAffected: result.rowsAffected,
        },
      };
    } catch (error) {
      context.log("SQL Proxy error:", error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error: error.message || "Query execution failed",
        },
      };
    }
  },
});
