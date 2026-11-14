import { Navigation } from "@/components/navigation"
import Link from "next/link"
import { getAuthenticatedUser, getUserRole } from "@/lib/auth"
import { hasPermission, type Permission } from "@/lib/roles"

// Each card shows only to roles holding its permission. Finance reaches the
// client and contact lists read-only, so their wording drops the editing.
const adminOptions: {
  title: string
  description: string
  readOnlyDescription?: string
  href: string
  permission: Permission
}[] = [
  {
    title: "Import Data",
    description: "Migrate data from Azure SQL Server to Supabase",
    href: "/admin/import",
    permission: "system.admin",
  },
  {
    title: "Database Overview",
    description: "Browse and inspect database tables",
    href: "/admin/database",
    permission: "system.admin",
  },
  {
    title: "Manage Clients",
    description: "Add, edit, or remove client records",
    readOnlyDescription: "View client records",
    href: "/admin/clients",
    permission: "clients.view",
  },
  {
    title: "Manage Contacts",
    description: "Add, edit, or remove contact records",
    readOnlyDescription: "View contact records",
    href: "/admin/contacts",
    permission: "clients.view",
  },
  {
    title: "Manage Users",
    description: "Add users and remove access",
    href: "/admin/users",
    permission: "users.manage",
  },
  {
    title: "Settings",
    description: "Configure system settings",
    href: "/admin/settings",
    permission: "system.admin",
  },
]

export default async function AdminPage() {
  const role = getUserRole(await getAuthenticatedUser())
  const canEditClients = hasPermission(role, "clients.edit")
  const options = adminOptions.filter((option) => hasPermission(role, option.permission))

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-foreground">Admin</h1>
        <p className="mt-2 text-muted-foreground">
          System administration and data management
        </p>
        
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {options.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className="rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted"
            >
              <h2 className="text-lg font-semibold text-card-foreground">{option.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {canEditClients ? option.description : (option.readOnlyDescription ?? option.description)}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
