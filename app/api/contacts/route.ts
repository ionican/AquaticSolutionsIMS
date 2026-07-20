import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { fetchAllPages } from "@/lib/supabase-pagination"
import { NextRequest } from "next/server"

interface Contact {
  contact_id: number
  fname: string | null
  sname: string | null
  client_id: number
  title: string | null
  tel: string | null
  mobile: string | null
  email: string | null
  active: string | null
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseAdminClient()

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get("client_id")
  // "active" (default) hides deactivated contacts from operational selectors
  // (e.g. the New Job form); management views pass "all"/"inactive" explicitly.
  const statusParam = searchParams.get("status")
  const status = statusParam === "all" || statusParam === "inactive" ? statusParam : "active"

  const { data, error } = await fetchAllPages<Contact>((from, to) => {
    let query = supabase
      .from("contacts")
      .select("contact_id, fname, sname, client_id, title, tel, mobile, email, active")
      .order("sname")
      .order("contact_id")

    if (clientId) {
      query = query.eq("client_id", parseInt(clientId))
    }
    if (status === "active") query = query.or("active.is.null,active.neq.n")
    else if (status === "inactive") query = query.eq("active", "n")

    return query.range(from, to)
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ contacts: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await req.json()
    const clientId = body.client_id ? parseInt(String(body.client_id)) : NaN

    if (Number.isNaN(clientId)) {
      return Response.json({ error: "Client is required" }, { status: 400 })
    }

    if (!body.fname && !body.sname) {
      return Response.json({ error: "Enter a first name or surname" }, { status: 400 })
    }

    const { data: maxContact, error: maxContactError } = await supabase
      .from("contacts")
      .select("contact_id")
      .order("contact_id", { ascending: false })
      .limit(1)
      .single()

    if (maxContactError) {
      return Response.json({ error: maxContactError.message }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        contact_id: (maxContact?.contact_id || 0) + 1,
        client_id: clientId,
        title: body.title || null,
        fname: body.fname || null,
        sname: body.sname || null,
        tel: body.tel || null,
        mobile: body.mobile || null,
        email: body.email || null,
        active: "y",
        updateddateutc: new Date().toISOString(),
      })
      .select("contact_id, fname, sname, client_id, title, tel, mobile, email, active")
      .single()

    if (error) {
      console.error("[v0] Error creating contact:", error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ contact: data })
  } catch (error) {
    console.error("[v0] Error in contacts API:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create contact" },
      { status: 500 }
    )
  }
}
