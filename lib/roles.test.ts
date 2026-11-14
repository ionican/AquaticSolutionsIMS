import { test } from "node:test"
import assert from "node:assert/strict"
import {
  canWriteEventField,
  PERMISSIONS,
  ROLES,
  checkEventCreate,
  checkEventUpdate,
  hasPermission,
  pagePermission,
  parseRole,
  roleFromAppMetadata,
  type Permission,
  type Role,
} from "./roles.ts"

// The matrix decided by Richard, written out longhand so a change to
// ROLE_PERMISSIONS has to be made deliberately in two places.
const MATRIX: Record<Role, Record<Permission, boolean>> = {
  admin: {
    "jobs.view": true, "jobs.edit": true, "events.money.edit": true,
    "clients.view": true, "clients.edit": true, "dashboard.view": true,
    "users.manage": true, "system.admin": true,
  },
  project_manager: {
    "jobs.view": true, "jobs.edit": true, "events.money.edit": false,
    "clients.view": true, "clients.edit": true, "dashboard.view": true,
    "users.manage": false, "system.admin": false,
  },
  finance: {
    "jobs.view": true, "jobs.edit": false, "events.money.edit": true,
    "clients.view": true, "clients.edit": false, "dashboard.view": true,
    "users.manage": false, "system.admin": false,
  },
}

test("permission matrix", () => {
  for (const role of ROLES) {
    for (const permission of PERMISSIONS) {
      assert.equal(hasPermission(role, permission), MATRIX[role][permission], `${role} / ${permission}`)
    }
  }
})

test("no role is denied every permission", () => {
  for (const permission of PERMISSIONS) {
    assert.equal(hasPermission(null, permission), false, permission)
  }
})

test("role parsing fails closed", () => {
  assert.equal(parseRole("admin"), "admin")
  assert.equal(parseRole("finance"), "finance")
  for (const bad of [undefined, null, "", "Admin", "superuser", 1, {}, ["admin"]]) {
    assert.equal(parseRole(bad), null, JSON.stringify(bad))
  }
  assert.equal(roleFromAppMetadata({ role: "project_manager", provider: "email" }), "project_manager")
  assert.equal(roleFromAppMetadata({ provider: "email" }), null)
  assert.equal(roleFromAppMetadata(null), null)
  assert.equal(roleFromAppMetadata(undefined), null)
})

test("page permissions", () => {
  assert.equal(pagePermission("/admin/users"), "users.manage")
  assert.equal(pagePermission("/admin/import"), "system.admin")
  assert.equal(pagePermission("/admin/database"), "system.admin")
  assert.equal(pagePermission("/admin/settings"), "system.admin")
  assert.equal(pagePermission("/jobs/new"), "jobs.edit")
  assert.equal(pagePermission("/admin"), null)
  assert.equal(pagePermission("/admin/clients"), null)
  assert.equal(pagePermission("/admin/usersx"), null)
  assert.equal(pagePermission("/jobs/12"), null)
})

// A stored row as PostgREST returns it: timestamps, nullable flags.
const STORED = {
  id: 7,
  task_name: "Service visit",
  eventtype: "Service",
  resource: null,
  date: "2026-05-01T00:00:00",
  start_date: null,
  man_days: 2,
  invoice_value: 1500,
  invoicable: true,
  completed: false,
  warranty: null,
}

// What the edit form sends back untouched, after coerceEventFields.
const UNCHANGED = {
  task_name: "Service visit",
  eventtype: "Service",
  resource: null,
  date: "2026-05-01",
  start_date: null,
  man_days: 2,
  invoice_value: 1500,
  invoicable: true,
  completed: false,
  warranty: false,
}

test("PM changing invoice_value is denied", () => {
  const result = checkEventUpdate("project_manager", { ...UNCHANGED, invoice_value: 2000 }, STORED)
  assert.equal(result.ok, false)
})

test("PM changing invoicable is denied", () => {
  assert.equal(checkEventUpdate("project_manager", { invoicable: false }, STORED).ok, false)
})

test("PM resending unchanged money values is allowed", () => {
  assert.equal(checkEventUpdate("project_manager", UNCHANGED, STORED).ok, true)
  assert.equal(checkEventUpdate("project_manager", { ...UNCHANGED, task_name: "Repair" }, STORED).ok, true)
})

test("PM create: money fields must stay empty", () => {
  const blank = { task_name: "New", invoice_value: null, invoicable: false }
  assert.equal(checkEventCreate("project_manager", blank).ok, true)
  assert.equal(checkEventCreate("project_manager", { ...blank, invoice_value: 100 }).ok, false)
  assert.equal(checkEventCreate("project_manager", { ...blank, invoice_value: 0 }).ok, false)
  assert.equal(checkEventCreate("project_manager", { ...blank, invoicable: true }).ok, false)
})

test("Finance changing task_name is denied", () => {
  const result = checkEventUpdate("finance", { ...UNCHANGED, task_name: "Renamed" }, STORED)
  assert.equal(result.ok, false)
})

test("Finance changing invoice_value is allowed", () => {
  assert.equal(checkEventUpdate("finance", { invoice_value: 2000 }, STORED).ok, true)
  assert.equal(checkEventUpdate("finance", { ...UNCHANGED, invoice_value: 2000, invoicable: false }, STORED).ok, true)
})

test("Finance cannot create events", () => {
  assert.equal(checkEventCreate("finance", { task_name: "New", invoice_value: null, invoicable: false }).ok, false)
})

test("Admin is unrestricted", () => {
  assert.equal(checkEventCreate("admin", { task_name: "New", invoice_value: 100, invoicable: true }).ok, true)
  assert.equal(checkEventUpdate("admin", { ...UNCHANGED, task_name: "X", invoice_value: 1 }, STORED).ok, true)
})

test("no role is denied every event write", () => {
  assert.equal(checkEventCreate(null, { task_name: "New" }).ok, false)
  assert.equal(checkEventUpdate(null, UNCHANGED, STORED).ok, false)
  assert.equal(checkEventUpdate(null, { invoice_value: 1 }, STORED).ok, false)
})

test("date and number comparisons ignore representation only", () => {
  assert.equal(checkEventUpdate("finance", { date: "2026-05-02" }, STORED).ok, false)
  assert.equal(checkEventUpdate("finance", { man_days: 2 }, { ...STORED, man_days: "2" }).ok, true)
  assert.equal(checkEventUpdate("project_manager", { invoice_value: 1500 }, { ...STORED, invoice_value: "1500.00" }).ok, true)
})

test("canWriteEventField follows the matrix", () => {
  assert.equal(canWriteEventField("project_manager", "task_name"), true)
  assert.equal(canWriteEventField("project_manager", "invoice_value"), false)
  assert.equal(canWriteEventField("finance", "invoicable"), true)
  assert.equal(canWriteEventField("finance", "completed"), false)
  assert.equal(canWriteEventField("admin", "invoice_value"), true)
  assert.equal(canWriteEventField(null, "task_name"), false)
})
