import { Navigation } from "@/components/navigation"

export default function ReportsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-foreground">Reports</h1>
        <p className="mt-2 text-muted-foreground">
          Generate and view project reports
        </p>
        
        <div className="mt-8 rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Reports will be available once data has been imported.</p>
        </div>
      </main>
    </div>
  )
}
