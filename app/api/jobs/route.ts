import { createClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(req.url)

  const page = parseInt(searchParams.get("page") || "1")
  const pageSize = parseInt(searchParams.get("pageSize") || "50")
  const sortBy = searchParams.get("sortBy") || "id"
  const sortDir = searchParams.get("sortDir") || "desc"
  const search = searchParams.get("search") || ""
  const status = searchParams.get("status") || ""
  const jobType = searchParams.get("jobType") || ""
  const jobClass = searchParams.get("jobClass") || ""

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Fetch jobs without joins (no FK constraints defined)
  let query = supabase
    .from("jobs")
    .select(
      "id, enquiry_id, project_name, site, site_pcode, status, enquiry_date, contract_start, contract_end, quotation_value, ordervalue, job_type_id, job_class_id, client_id, contact_id, nature, source, order_number",
      { count: "exact" }
    )
    .order(sortBy, { ascending: sortDir === "asc" })
    .range(from, to)

  if (search) {
    query = query.or(`project_name.ilike.%${search}%,site.ilike.%${search}%,order_number.ilike.%${search}%`)
  }
  if (status) query = query.eq("status", status)
  if (jobType) query = query.eq("job_type_id", parseInt(jobType))
  if (jobClass) query = query.eq("job_class_id", parseInt(jobClass))

  const { data: jobs, error, count } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!jobs || jobs.length === 0) {
    return Response.json({ data: [], count: 0, page, pageSize })
  }

  // Manual joins — collect unique IDs then fetch lookup tables
  const clientIds = [...new Set(jobs.map((j: { client_id: number }) => j.client_id).filter(Boolean))]
  const contactIds = [...new Set(jobs.map((j: { contact_id: number }) => j.contact_id).filter(Boolean))]
  const jobTypeIds = [...new Set(jobs.map((j: { job_type_id: number }) => j.job_type_id).filter(Boolean))]
  const jobClassIds = [...new Set(jobs.map((j: { job_class_id: number }) => j.job_class_id).filter(Boolean))]

  const [clientsRes, contactsRes, typesRes, classesRes] = await Promise.all([
    clientIds.length ? supabase.from("clients").select("client_id, business_name").in("client_id", clientIds) : { data: [] },
    contactIds.length ? supabase.from("contacts").select("contact_id, fname, sname").in("contact_id", contactIds) : { data: [] },
    jobTypeIds.length ? supabase.from("job_types").select("job_type_id, job_type").in("job_type_id", jobTypeIds) : { data: [] },
    jobClassIds.length ? supabase.from("job_classes").select("job_class_id, job_class").in("job_class_id", jobClassIds) : { data: [] },
  ])

  // Build lookup maps
  const clientMap = Object.fromEntries((clientsRes.data || []).map((c: { client_id: number; business_name: string }) => [c.client_id, c]))
  const contactMap = Object.fromEntries((contactsRes.data || []).map((c: { contact_id: number; fname: string; sname: string }) => [c.contact_id, c]))
  const typeMap = Object.fromEntries((typesRes.data || []).map((t: { job_type_id: number; job_type: string }) => [t.job_type_id, t]))
  const classMap = Object.fromEntries((classesRes.data || []).map((c: { job_class_id: number; job_class: string }) => [c.job_class_id, c]))

  // Merge lookups into jobs
  const data = jobs.map((job: { client_id: number; contact_id: number; job_type_id: number; job_class_id: number }) => ({
    ...job,
    clients: clientMap[job.client_id] ?? null,
    contacts: contactMap[job.contact_id] ?? null,
    job_types: typeMap[job.job_type_id] ?? null,
    job_classes: classMap[job.job_class_id] ?? null,
  }))

  return Response.json({ data, count, page, pageSize })
}
