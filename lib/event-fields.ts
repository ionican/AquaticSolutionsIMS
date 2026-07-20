// Shared whitelist + coercion for the editable columns of an `events` row.
// Used by both the create (POST /api/events) and update (PATCH /api/events/[id])
// routes so the two stay in lockstep. Identity/link columns (id, task_id,
// enquiry_id, company_id) are handled by the routes themselves, never here.

export const EVENT_TEXT_FIELDS = ["task_name", "eventtype", "resource"] as const
export const EVENT_DATE_FIELDS = ["date", "start_date"] as const
export const EVENT_NUMBER_FIELDS = ["man_days", "invoice_value"] as const
export const EVENT_BOOL_FIELDS = ["invoicable", "completed", "warranty"] as const

type Body = Record<string, unknown>
type CoerceResult = { data: Record<string, unknown> } | { error: string }

// Pull the whitelisted fields out of `body`, coercing each to its column type.
// By default only fields actually present in the body are included (a partial
// update). Pass { requireAll: true } to always emit every field (a full insert),
// with absent fields resolving to their empty/null default.
export function coerceEventFields(body: Body, { requireAll = false } = {}): CoerceResult {
  const out: Record<string, unknown> = {}

  for (const field of EVENT_TEXT_FIELDS) {
    if (requireAll || field in body) {
      const value = body[field]
      out[field] = value == null || value === "" ? null : String(value)
    }
  }

  for (const field of EVENT_DATE_FIELDS) {
    if (requireAll || field in body) {
      const value = body[field]
      out[field] = value ? String(value) : null
    }
  }

  for (const field of EVENT_NUMBER_FIELDS) {
    if (requireAll || field in body) {
      const value = body[field]
      if (value == null || value === "") {
        out[field] = null
      } else {
        const parsed = Number(value)
        if (Number.isNaN(parsed)) return { error: `${field} must be a number` }
        out[field] = parsed
      }
    }
  }

  for (const field of EVENT_BOOL_FIELDS) {
    if (requireAll || field in body) out[field] = body[field] === true
  }

  return { data: out }
}
