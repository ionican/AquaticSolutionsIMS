/**
 * Legacy User Migration Script
 *
 * Reads users from the AspNetUsers table in Azure SQL and creates
 * corresponding accounts in Supabase Auth. ASP.NET Identity password
 * hashes are incompatible with Supabase, so users are created with
 * temporary passwords and sent a password reset email.
 *
 * Usage:
 *   npx tsx scripts/migrate-users.ts
 *
 * Required env vars:
 *   AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, AZURE_SQL_PASSWORD
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js"

async function main() {
  // --- Connect to Azure SQL ---
  const sql = await import("mssql")

  const sqlConfig: import("mssql").config = {
    server: process.env.AZURE_SQL_SERVER || "",
    database: process.env.AZURE_SQL_DATABASE || "",
    user: process.env.AZURE_SQL_USER || "",
    password: process.env.AZURE_SQL_PASSWORD || "",
    options: { encrypt: true, trustServerCertificate: false },
  }

  console.log("Connecting to Azure SQL...")
  const pool = await sql.default.connect(sqlConfig)

  // --- Fetch legacy users ---
  const result = await pool.request().query(`
    SELECT
      u.Id,
      u.Email,
      u.UserName,
      u.EmailConfirmed,
      u.LockoutEnabled,
      u.AccessFailedCount,
      STRING_AGG(r.Name, ',') AS Roles
    FROM AspNetUsers u
    LEFT JOIN AspNetUserRoles ur ON u.Id = ur.UserId
    LEFT JOIN AspNetRoles r ON ur.RoleId = r.Id
    GROUP BY u.Id, u.Email, u.UserName, u.EmailConfirmed, u.LockoutEnabled, u.AccessFailedCount
    ORDER BY u.Email
  `)

  const legacyUsers = result.recordset
  console.log(`Found ${legacyUsers.length} users in AspNetUsers`)

  await pool.close()

  // --- Connect to Supabase ---
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // --- Map ASP.NET roles to our roles ---
  function mapRole(aspNetRoles: string | null): "viewer" | "editor" | "admin" {
    if (!aspNetRoles) return "viewer"
    const roles = aspNetRoles.toLowerCase().split(",")
    if (roles.includes("admin") || roles.includes("administrator")) return "admin"
    if (roles.includes("editor") || roles.includes("manager")) return "editor"
    return "viewer"
  }

  // --- Migrate each user ---
  let created = 0
  let skipped = 0
  let failed = 0

  for (const legacyUser of legacyUsers) {
    const email = legacyUser.Email?.trim()
    if (!email) {
      console.log(`  SKIP: No email for user ${legacyUser.Id}`)
      skipped++
      continue
    }

    const role = mapRole(legacyUser.Roles)

    // Check if user already exists in Supabase
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existing = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (existing) {
      console.log(`  SKIP: ${email} already exists in Supabase`)
      skipped++

      // Ensure role is set
      await supabase
        .from("user_roles")
        .upsert({ user_id: existing.id, role, updated_at: new Date().toISOString() })

      continue
    }

    // Create user with temporary password
    const tempPassword = crypto.randomUUID()
    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { role, migrated_from: "aspnet", legacy_id: legacyUser.Id },
      })

    if (createError) {
      console.error(`  FAIL: ${email} — ${createError.message}`)
      failed++
      continue
    }

    // Assign role
    await supabase
      .from("user_roles")
      .upsert({ user_id: newUser.user.id, role, updated_at: new Date().toISOString() })

    // Generate password reset link (user will set their own password)
    await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    })

    console.log(`  OK: ${email} → ${role}`)
    created++
  }

  console.log("\n--- Migration Summary ---")
  console.log(`  Created: ${created}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed:  ${failed}`)
  console.log(
    "\nUsers will need to reset their passwords via the login page."
  )
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
