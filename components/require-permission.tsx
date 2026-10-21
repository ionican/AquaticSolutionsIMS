import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { getAuthenticatedUser, getUserRole } from "@/lib/auth"
import { hasPermission, pagePermission } from "@/lib/roles"

// Server-side gate for a page segment, used from its layout.tsx. The page's
// data comes through the API, which checks again; this stops the page itself
// rendering for a role that cannot use it.
export async function RequirePermission({ path, children }: { path: string; children: React.ReactNode }) {
  const permission = pagePermission(path)
  const role = getUserRole(await getAuthenticatedUser())

  if (permission && hasPermission(role, permission)) return children

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground/60" />
          <h1 className="mt-4 text-lg font-semibold text-card-foreground">You don&apos;t have access to this page</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Your role does not include it. Ask an administrator if you need access.
          </p>
          <Link
            href="/"
            className="mt-6 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  )
}
