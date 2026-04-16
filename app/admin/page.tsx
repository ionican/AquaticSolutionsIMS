import { Navigation } from "@/components/navigation"
import Link from "next/link"

const adminOptions = [
  {
    title: "Manage Users",
    description: "Add, edit, or remove users and assign roles",
    href: "/admin/users",
  },
  {
    title: "Import Data",
    description: "Migrate data from Azure SQL Server to Supabase",
    href: "/admin/import",
  },
  {
    title: "Database Overview",
    description: "Browse and inspect database tables",
    href: "/admin/database",
  },
  {
    title: "Manage Clients",
    description: "Add, edit, or remove client records",
    href: "/admin/clients",
  },
  {
    title: "Manage Contacts",
    description: "Add, edit, or remove contact records",
    href: "/admin/contacts",
  },
  {
    title: "Settings",
    description: "Configure system settings",
    href: "/admin/settings",
  },
]

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-foreground">Admin</h1>
        <p className="mt-2 text-muted-foreground">
          System administration and data management
        </p>
        
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {adminOptions.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className="rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted"
            >
              <h2 className="text-lg font-semibold text-card-foreground">{option.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
