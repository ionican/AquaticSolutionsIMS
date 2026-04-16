/**
 * Auth types and permission constants.
 *
 * Roles provide default permissions. Per-user overrides in user_permissions
 * can grant or revoke individual permissions.
 */

export type Role = "viewer" | "editor" | "admin"

export const PERMISSIONS = {
  // Jobs
  "jobs:read": "View job listings and details",
  "jobs:write": "Create and edit jobs",
  "jobs:export": "Bulk export job data",

  // Clients
  "clients:read": "View client listings",
  "clients:write": "Create and edit clients",
  "clients:export": "Bulk export client data",

  // Contacts
  "contacts:read": "View contact listings",
  "contacts:write": "Create and edit contacts",
  "contacts:export": "Bulk export contact data",

  // Admin
  "admin:access": "Access admin pages",
  "users:manage": "Manage users and roles",
  "migration:run": "Run data migrations",
  "database:browse": "Browse raw database tables",
} as const

export type Permission = keyof typeof PERMISSIONS

/** Default permissions for each role. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: [
    "jobs:read",
    "clients:read",
    "contacts:read",
  ],
  editor: [
    "jobs:read",
    "jobs:write",
    "jobs:export",
    "clients:read",
    "clients:write",
    "contacts:read",
    "contacts:write",
  ],
  admin: [
    "jobs:read",
    "jobs:write",
    "jobs:export",
    "clients:read",
    "clients:write",
    "clients:export",
    "contacts:read",
    "contacts:write",
    "contacts:export",
    "admin:access",
    "users:manage",
    "migration:run",
    "database:browse",
  ],
}

/** Route → required permission mapping for the middleware. */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/admin": "admin:access",
  "/admin/database": "database:browse",
  "/admin/import": "migration:run",
  "/admin/users": "users:manage",
}

/** API rate limits: [max requests, window in seconds]. */
export const RATE_LIMITS: Record<string, [number, number]> = {
  "GET:/api/clients":         [10, 60],
  "GET:/api/contacts":        [10, 60],
  "GET:/api/jobs":            [20, 60],
  "GET:/api/jobs/filters":    [20, 60],
  "GET:/api/dashboard/stats": [20, 60],
  "POST:/api/jobs/create":    [10, 60],
  "PATCH:/api/jobs":          [10, 60],
  // Export endpoints are heavily limited
  "GET:/api/clients/export":  [2, 3600],
  "GET:/api/contacts/export": [2, 3600],
  "GET:/api/jobs/export":     [2, 3600],
}

/** Maximum records per page — enforced server-side, cannot be overridden. */
export const MAX_PAGE_SIZE = 50
