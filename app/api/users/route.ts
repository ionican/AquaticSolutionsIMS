import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { NextRequest } from "next/server"
import { requireApiUser } from "@/lib/auth"
import type { User } from "@supabase/supabase-js"

// Users exist only in Supabase auth — there is no app-level users table.
interface ManagedUser {
  id: string
  email: string | null
  created_at: string | null
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  invited_at: string | null
}

// Only the fields the admin UI renders. The full auth user carries identities,
// app_metadata and tokens that have no business reaching the browser.
function toManagedUser(user: User): ManagedUser {
  return {
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    invited_at: user.invited_at ?? null,
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ users: (data?.users || []).map(toManagedUser) })
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  try {
    const supabase = createSupabaseAdminClient()
    const body = await req.json()
    const email = typeof body.email === "string" ? body.email.trim() : ""

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 })
    }

    if (!EMAIL_PATTERN.test(email)) {
      return Response.json({ error: "Enter a valid email address" }, { status: 400 })
    }

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${new URL(req.url).origin}/auth/confirm`,
    })

    if (error) {
      // Supabase reports an address that is already registered as 422 /
      // email_exists; surface it as a conflict rather than a server fault.
      if (error.code === "email_exists" || /already (registered|exists)/i.test(error.message)) {
        return Response.json(
          { error: "A user with that email already exists" },
          { status: 409 }
        )
      }
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ user: toManagedUser(data.user) })
  } catch (error) {
    console.error("[v0] Error in users API:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to invite user" },
      { status: 500 }
    )
  }
}
