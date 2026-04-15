"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Briefcase, Users, CalendarClock, Loader2, Plus } from "lucide-react"

interface Stats {
  activeJobs: number
  totalClients: number
  pendingEvents: number
  totalJobs: number
  totalEvents: number
}

export default function HomePage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then(res => res.json())
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              Welcome to the Project Management System
            </p>
          </div>
          <Button onClick={() => router.push("/jobs/new")} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            New Job
          </Button>
        </div>
        
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">Active Jobs</h2>
                {loading ? (
                  <Loader2 className="mt-1 h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stats?.activeJobs?.toLocaleString() ?? 0}</p>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              of {stats?.totalJobs?.toLocaleString() ?? 0} total projects
            </p>
          </div>
          
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">Clients</h2>
                {loading ? (
                  <Loader2 className="mt-1 h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stats?.totalClients?.toLocaleString() ?? 0}</p>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Total registered clients
            </p>
          </div>
          
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">Pending Events</h2>
                {loading ? (
                  <Loader2 className="mt-1 h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stats?.pendingEvents?.toLocaleString() ?? 0}</p>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              of {stats?.totalEvents?.toLocaleString() ?? 0} total events
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
