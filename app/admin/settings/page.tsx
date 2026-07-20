import { Navigation } from "@/components/navigation"
import { Settings } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-xs text-muted-foreground mb-1">
          <Link href="/admin" className="hover:text-foreground">Admin</Link> / Settings
        </div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-2 text-muted-foreground">Configure system settings</p>

        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <Settings className="h-10 w-10 text-muted-foreground/60" />
          <h2 className="mt-4 text-lg font-semibold text-card-foreground">Coming soon</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            System settings haven&apos;t been configured yet. This section is a placeholder — let us know
            what you&apos;d like to manage here and it can be added.
          </p>
          <Link
            href="/admin"
            className="mt-6 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Back to Admin
          </Link>
        </div>
      </main>
    </div>
  )
}
