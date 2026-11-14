#!/usr/bin/env node
// Sets a user's role in Supabase Auth app_metadata. One-off bootstrap: run it
// for the existing users BEFORE deploying the roles change, otherwise nobody
// holds a role and everyone is locked out (no role = no access).
//
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/set-role.mjs <email> <admin|project_manager|finance>
//
// Imports lib/roles.ts directly, which needs Node 22.18+ (type stripping).
import { createClient } from "@supabase/supabase-js"
import { ROLES } from "../lib/roles.ts"

const [email, role] = process.argv.slice(2)

if (!email || !role) {
  console.error("Usage: node scripts/set-role.mjs <email> <admin|project_manager|finance>")
  process.exit(1)
}

if (!ROLES.includes(role)) {
  console.error(`Unknown role "${role}". Use one of: ${ROLES.join(", ")}`)
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// listUsers has no email filter; page through until the address turns up.
async function findUser(address) {
  const perPage = 1000
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    const match = users.find((user) => user.email?.toLowerCase() === address.toLowerCase())
    if (match) return match
    if (users.length < perPage) return null
  }
}

const user = await findUser(email)

if (!user) {
  console.error(`No user with email ${email}`)
  process.exit(1)
}

// Merge: app_metadata also holds the auth provider details.
const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
  app_metadata: { ...user.app_metadata, role },
})

if (error) {
  console.error(`Failed: ${error.message}`)
  process.exit(1)
}

console.log(`${data.user.email}: role was ${user.app_metadata?.role ?? "(none)"}, now ${data.user.app_metadata?.role}`)
