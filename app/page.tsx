"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Briefcase, Users, CalendarClock, Plus } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

interface DashboardStats {
  activeJobs: number
  totalClients: number
  pendingEvents: number
  totalJobs: number
  totalEvents: number
}

function formatCount(value?: number) {
  return typeof value === "number" ? new Intl.NumberFormat("en-GB").format(value) : "-"
}

function statsDetail({
  loading,
  error,
  loadedText,
}: {
  loading: boolean
  error: boolean
  loadedText: string
}) {
  if (error) return "Unable to load live data"
  if (loading) return "Loading live data..."
  return loadedText
}

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      try {
        const response = await fetch("/api/dashboard/stats")

        if (!response.ok) throw new Error("Failed to load dashboard stats")

        const data = await response.json()

        if (!cancelled) {
          setStats(data)
          setStatsError(false)
        }
      } catch (error) {
        console.error("Dashboard stats error:", error)
        if (!cancelled) setStatsError(true)
      } finally {
        if (!cancelled) setLoadingStats(false)
      }
    }

    loadStats()

    return () => {
      cancelled = true
    }
  }, [])

  const statsMessage = statsDetail({
    loading: loadingStats,
    error: statsError,
    loadedText: "Live from Supabase",
  })

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
          <Button size="lg" asChild>
            <Link href="/jobs/new">
              <Plus className="h-5 w-5 mr-2" />
              New Job
            </Link>
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
                <p className="text-2xl font-bold text-foreground">{formatCount(stats?.activeJobs)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {statsDetail({
                loading: loadingStats,
                error: statsError,
                loadedText: `${formatCount(stats?.totalJobs)} total jobs`,
              })}
            </p>
          </div>
          
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">Clients</h2>
                <p className="text-2xl font-bold text-foreground">{formatCount(stats?.totalClients)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {statsMessage}
            </p>
          </div>
          
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">Pending Events</h2>
                <p className="text-2xl font-bold text-foreground">{formatCount(stats?.pendingEvents)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {statsDetail({
                loading: loadingStats,
                error: statsError,
                loadedText: `of ${formatCount(stats?.totalEvents)} total events`,
              })}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
