// Roles and permissions — the single source for who may do what. Pure module:
// no Supabase and no `@/` imports, so the proxy, route handlers, client
// components and the node:test suite can all load it.
//
// The role lives in Supabase Auth `app_metadata.role`, which only the service
// role can write. A missing or unrecognised value is "no role" and fails
// closed: no permission is granted.

export const ROLES = ["admin", "project_manager", "finance"] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  project_manager: "Project Manager",
  finance: "Finance",
}

export const PERMISSIONS = [
  // Jobs and events: view.
  "jobs.view",
  // Jobs and events: create, edit and delete, except the event money fields.
  "jobs.edit",
  // Event money fields (`invoice_value`, `invoicable`): edit.
  "events.money.edit",
  // Clients and contacts.
  "clients.view",
  "clients.edit",
  // Dashboard, reports and ready-to-invoice.
  "dashboard.view",
  // List, invite, delete and change the role of users.
  "users.manage",
  // Data import/migration, database browser and settings.
  "system.admin",
] as const
export type Permission = (typeof PERMISSIONS)[number]

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  project_manager: ["jobs.view", "jobs.edit", "clients.view", "clients.edit", "dashboard.view"],
  finance: ["jobs.view", "events.money.edit", "clients.view", "dashboard.view"],
}

export function parseRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : null
}

// Reads the role from a Supabase user's app_metadata. Never user_metadata:
// the user can write that one themselves.
export function roleFromAppMetadata(appMetadata: unknown): Role | null {
  if (!appMetadata || typeof appMetadata !== "object") return null
  return parseRole((appMetadata as Record<string, unknown>).role)
}

export function hasPermission(role: Role | null, permission: Permission): boolean {
  return role !== null && ROLE_PERMISSIONS[role].includes(permission)
}

export function roleLabel(role: Role | null): string {
  return role ? ROLE_LABELS[role] : "No role"
}

// Pages that need more than "signed in with a role". Longest matching prefix
// wins; anything unlisted only needs a valid role.
const PAGE_PERMISSIONS: [prefix: string, permission: Permission][] = [
  ["/admin/users", "users.manage"],
  ["/admin/import", "system.admin"],
  ["/admin/database", "system.admin"],
  ["/admin/settings", "system.admin"],
  ["/jobs/new", "jobs.edit"],
]

export function pagePermission(pathname: string): Permission | null {
  const match = PAGE_PERMISSIONS
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0]
  return match ? match[1] : null
}

// ---------------------------------------------------------------------------
// Event money-field rule
// ---------------------------------------------------------------------------

export const EVENT_MONEY_FIELDS = ["invoice_value", "invoicable"] as const

// How each event column is compared. Stored dates are timestamps
// ("2013-07-01T00:00:00") while the edit form sends a bare date, so compare the
// date part; flags are nullable, so an unset flag equals `false`.
const EVENT_DATE_COLUMNS = new Set(["date", "start_date"])
const EVENT_NUMBER_COLUMNS = new Set(["man_days", "invoice_value"])
const EVENT_FLAG_COLUMNS = new Set(["invoicable", "completed", "warranty"])

type Row = Record<string, unknown>
export type EventWriteCheck = { ok: true } | { ok: false; error: string }

function normalise(field: string, value: unknown): unknown {
  if (EVENT_FLAG_COLUMNS.has(field)) return value === true
  if (value === undefined || value === null || value === "") return null
  if (EVENT_DATE_COLUMNS.has(field)) return String(value).slice(0, 10)
  if (EVENT_NUMBER_COLUMNS.has(field)) return Number(value)
  return value
}

// The fields in `changes` that would actually alter the stored row.
export function changedEventFields(changes: Row, stored: Row): string[] {
  return Object.keys(changes).filter((field) => normalise(field, changes[field]) !== normalise(field, stored[field]))
}

const MONEY = new Set<string>(EVENT_MONEY_FIELDS)

// Whether `role` may write `field` of an event at all.
export function canWriteEventField(role: Role | null, field: string): boolean {
  return hasPermission(role, MONEY.has(field) ? "events.money.edit" : "jobs.edit")
}

// Decides whether `role` may create an event with `changes`. `changes` holds
// the coerced editable columns only (see lib/event-fields.ts).
export function checkEventCreate(role: Role | null, changes: Row): EventWriteCheck {
  if (!hasPermission(role, "jobs.edit")) {
    return { ok: false, error: "Your role cannot create events" }
  }
  if (!hasPermission(role, "events.money.edit")) {
    // A blank value and an unticked box are the defaults; anything else sets money.
    if (normalise("invoice_value", changes.invoice_value) !== null || changes.invoicable === true) {
      return { ok: false, error: "Your role cannot set the event value or billable flag" }
    }
  }
  return { ok: true }
}

// Decides whether `role` may apply `changes` to the `stored` event row. Fields
// sent back unchanged are allowed, because the edit form resends every field.
export function checkEventUpdate(role: Role | null, changes: Row, stored: Row): EventWriteCheck {
  const canEdit = hasPermission(role, "jobs.edit")
  const canEditMoney = hasPermission(role, "events.money.edit")
  if (!canEdit && !canEditMoney) {
    return { ok: false, error: "Your role cannot edit events" }
  }

  const changed = changedEventFields(changes, stored)
  if (!canEditMoney && changed.some((field) => MONEY.has(field))) {
    return { ok: false, error: "Your role cannot change the event value or billable flag" }
  }
  if (!canEdit && changed.some((field) => !MONEY.has(field))) {
    return { ok: false, error: "Your role can only change the event value and billable flag" }
  }
  return { ok: true }
}
