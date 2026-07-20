import { createSupabaseAdminClient } from "@/lib/supabase-server"
import { coerceEventFields } from "@/lib/event-fields"
import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdminClient()
  const body = await req.json()

  const enquiryId = Number(body.enquiry_id)
  if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
    return Response.json({ error: "A valid enquiry_id is required" }, { status: 400 })
  }

  // The event must attach to a real company-6 job — never create an orphan.
  const { data: jobs, error: jobError } = await supabase
    .from("jobs")
    .select("enquiry_id")
    .eq("enquiry_id", enquiryId)
    .eq("company_id", 6)
    .limit(1)

  if (jobError) {
    return Response.json({ error: jobError.message }, { status: 500 })
  }
  if (!jobs || jobs.length === 0) {
    return Response.json({ error: "Job not found" }, { status: 404 })
  }

  const coerced = coerceEventFields(body, { requireAll: true })
  if ("error" in coerced) {
    return Response.json({ error: coerced.error }, { status: 400 })
  }

  // `events.id` has no DB sequence and mirrors `task_id` for every existing row;
  // keep that invariant by allocating one next value for both. task_id is the
  // canonical, always-populated key, so derive the max from it.
  const { data: maxRow } = await supabase
    .from("events")
    .select("task_id")
    .order("task_id", { ascending: false })
    .limit(1)
    .single()

  const nextId = (maxRow?.task_id || 0) + 1

  const row = {
    ...coerced.data,
    id: nextId,
    task_id: nextId,
    enquiry_id: enquiryId,
    company_id: 6,
    updateddateutc: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("events")
    .insert(row)
    .select("*")
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ event: data })
}
