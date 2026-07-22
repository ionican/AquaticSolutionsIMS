"use client"

import { Navigation } from "@/components/navigation"
import { Plus, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface Stats {
  activeJobs: number
  pendingEvents: number
}

interface RtiRow {
  id: number
  enquiry_id: number
  project_name: string
  site: string
  contract_end: string | null
  value: number | null
  business_name: string | null
}

interface Job {
  id: number
  enquiry_id: number
  project_name: string
  status: string
  clients: { business_name: string } | null
}

const nf = new Intl.NumberFormat("en-GB")

function fmtCount(v?: number | null) {
  return typeof v === "number" ? nf.format(v) : "—"
}

function fmtGBP(v?: number | null) {
  if (v == null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(v)
}

function fmtDate(v: string | null) {
  if (!v) return ""
  return new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

const STATUS_PILL: Record<string, string> = {
  Contracted: "bg-[#eef1f4] text-[#54636f]",
  "In progress": "bg-[#e0f3f5] text-[#0a7782]",
  Quoted: "bg-[#dde9fd] text-[#27488f]",
  Quoting: "bg-[#fcefd2] text-[#946312]",
  Enquiry: "bg-[#fcefd2] text-[#946312]",
  Contact: "bg-[#fcefd2] text-[#946312]",
  Completed: "bg-[#eef1f4] text-[#54636f]",
  Lost: "bg-[#fdecec] text-[#b42318]",
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md px-2 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide",
        STATUS_PILL[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </span>
  )
}

const thBase =
  "px-[1.05rem] py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground"

export default function HomePage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [rti, setRti] = useState<{ count: number; totalValue: number; data: RtiRow[] } | null>(null)
  const [recent, setRecent] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [statsRes, rtiRes, recentRes] = await Promise.all([
          fetch("/api/dashboard/stats"),
          fetch("/api/dashboard/ready-to-invoice"),
          fetch("/api/jobs?pageSize=6&sortBy=enquiry_id&sortDir=desc"),
        ])
        const statsData = await statsRes.json()
        const rtiData = await rtiRes.json()
        const recentData = await recentRes.json()
        if (!cancelled) {
          setStats(statsData)
          setRti(rtiData)
          setRecent(recentData.data || [])
          setError(!rtiRes.ok)
        }
      } catch (err) {
        console.error("Dashboard load error:", err)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const subline = error
    ? "Unable to load live data"
    : loading
      ? "Loading live data…"
      : `${today} · ${fmtCount(stats?.activeJobs)} active jobs · ${fmtCount(stats?.pendingEvents)} pending events`

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-[1320px] px-6 py-7">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[1.7rem] font-bold tracking-tight">{greeting()}, Tom</h1>
            <p className="mt-1.5 text-[0.9rem] text-muted-foreground">{subline}</p>
          </div>
          <div className="flex shrink-0 gap-2.5">
            <Link
              href="/admin/clients"
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-white px-[0.95rem] py-2.5 text-[0.85rem] font-semibold shadow-sm transition-colors hover:bg-[#fafbfc]"
            >
              <Plus className="size-[15px]" /> New client
            </Link>
            <Link
              href="/jobs/new"
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-primary bg-primary px-[0.95rem] py-2.5 text-[0.85rem] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[#0d93a1]"
            >
              <Plus className="size-[15px]" /> New job
            </Link>
          </div>
        </div>

        {/* Ready to Invoice — the hero */}
        <div className="mb-[1.1rem] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-[#fafbfc] px-[1.05rem] py-[0.85rem]">
            <span className="flex items-center gap-2 text-[0.74rem] font-bold uppercase tracking-[0.07em] text-secondary-foreground">
              <span className="size-2 rounded-full bg-destructive" /> Ready to Invoice
            </span>
            <Link href="/jobs" className="text-[0.78rem] font-semibold text-[#0d93a1] hover:underline">
              View all →
            </Link>
          </div>

          {/* Summary band */}
          <div className="flex items-center gap-10 border-b border-border px-[1.05rem] py-[1.1rem]">
            <div>
              <div className="text-[2rem] font-bold leading-none tabular-nums text-foreground">
                {loading ? "…" : fmtCount(rti?.count)}
              </div>
              <div className="mt-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Jobs ready
              </div>
            </div>
            <div>
              <div className="text-[2rem] font-bold leading-none tabular-nums text-foreground">
                {loading ? "…" : fmtGBP(rti?.totalValue)}
              </div>
              <div className="mt-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Total value
              </div>
            </div>
            <p className="ml-auto max-w-[320px] text-right text-[0.74rem] leading-snug text-muted-foreground">
              Won jobs whose end date has passed. Includes older jobs until we add a “mark as invoiced” step.
            </p>
          </div>

          {/* List */}
          <table className="w-full text-[0.82rem]">
            <thead>
              <tr className="border-b border-border">
                <th className={thBase}>Job</th>
                <th className={thBase}>Client</th>
                <th className={thBase}>Project</th>
                <th className={cn(thBase, "text-right")}>Ended</th>
                <th className={cn(thBase, "text-right")}>Value</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-[1.05rem] py-8 text-center text-muted-foreground">Loading…</td>
                </tr>
              ) : !rti || rti.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-[1.05rem] py-8 text-center text-muted-foreground">
                    Nothing ready to invoice
                  </td>
                </tr>
              ) : (
                rti.data.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className="cursor-pointer border-b border-[#eef1f3] last:border-0 hover:bg-[#f7fbfc]"
                  >
                    <td className="px-[1.05rem] py-[0.62rem] font-semibold tabular-nums text-foreground">{job.enquiry_id}</td>
                    <td className="px-[1.05rem] py-[0.62rem] max-w-[160px] truncate text-[#41525e]" title={job.business_name ?? ""}>
                      {job.business_name ?? ""}
                    </td>
                    <td className="px-[1.05rem] py-[0.62rem] max-w-[240px] truncate text-foreground" title={job.project_name}>
                      {job.project_name || <span className="italic text-muted-foreground">Untitled</span>}
                    </td>
                    <td className="px-[1.05rem] py-[0.62rem] text-right whitespace-nowrap text-muted-foreground tabular-nums">
                      {fmtDate(job.contract_end)}
                    </td>
                    <td className="px-[1.05rem] py-[0.62rem] text-right font-semibold tabular-nums text-foreground">
                      {fmtGBP(job.value)}
                    </td>
                    <td className="pr-[1.05rem] text-right text-muted-foreground/60">
                      <ChevronRight className="inline size-4" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {rti && rti.count > rti.data.length && (
            <div className="border-t border-border bg-[#fafbfc] px-[1.05rem] py-2 text-[0.74rem] text-muted-foreground">
              Showing the {rti.data.length} most recently ended of {fmtCount(rti.count)} jobs.
            </div>
          )}
        </div>

        {/* Recent jobs */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-[#fafbfc] px-[1.05rem] py-[0.85rem]">
            <span className="text-[0.74rem] font-bold uppercase tracking-[0.07em] text-secondary-foreground">Recent jobs</span>
            <Link href="/jobs" className="text-[0.78rem] font-semibold text-[#0d93a1] hover:underline">
              View all →
            </Link>
          </div>
          <table className="w-full text-[0.82rem]">
            <thead>
              <tr className="border-b border-border">
                <th className={thBase}>Job</th>
                <th className={thBase}>Client</th>
                <th className={thBase}>Project</th>
                <th className={cn(thBase, "text-right")}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-[1.05rem] py-8 text-center text-muted-foreground">Loading…</td>
                </tr>
              ) : recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-[1.05rem] py-8 text-center text-muted-foreground">No jobs</td>
                </tr>
              ) : (
                recent.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className="cursor-pointer border-b border-[#eef1f3] last:border-0 hover:bg-[#f7fbfc]"
                  >
                    <td className="px-[1.05rem] py-[0.62rem] font-semibold tabular-nums text-foreground">{job.enquiry_id}</td>
                    <td className="px-[1.05rem] py-[0.62rem] max-w-[180px] truncate text-[#41525e]" title={job.clients?.business_name ?? ""}>
                      {job.clients?.business_name ?? ""}
                    </td>
                    <td className="px-[1.05rem] py-[0.62rem] max-w-[240px] truncate text-foreground" title={job.project_name}>
                      {job.project_name || <span className="italic text-muted-foreground">Untitled</span>}
                    </td>
                    <td className="px-[1.05rem] py-[0.62rem] text-right whitespace-nowrap">
                      {job.status ? <StatusPill status={job.status} /> : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
