"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"

// Printable A4 job sheet (from the ims-job-sheet mockup). Reuses the same job
// data as the job detail page via /api/jobs/[id]; the on-screen toolbar is
// hidden when printing.

interface Contact {
  fname: string | null
  sname: string | null
  tel: string | null
  mobile: string | null
  email: string | null
  title: string | null
}
interface JobContact {
  id: number
  title: string | null
  jobsheet: boolean | null
  contact: Contact | null
}
interface Event {
  task_id: number
  task_name: string
  date: string
  start_date: string
  man_days: number
  print: boolean
}
interface Job {
  enquiry_id: number
  project_name: string
  site: string
  site_pcode: string
  notes: string
  sheetnote: string
  operative: string
  job_type: { job_type: string } | null
  client: { business_name: string } | null
  jobContacts: JobContact[]
}

function fmtDate(val: string | null) {
  if (!val) return "—"
  return new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function contactName(jc: JobContact) {
  const c = jc.contact
  if (!c) return "Contact"
  return [c.title, c.fname, c.sname].filter(Boolean).join(" ") || "Contact"
}

export default function JobSheetPage() {
  const params = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/jobs/${params.id}`)
        if (!res.ok) throw new Error("Job not found")
        const data = await res.json()
        setJob(data.job)
        setEvents(data.events || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load job")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#e9ecee] text-sm text-muted-foreground">Loading job sheet…</div>
  }
  if (error || !job) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#e9ecee]">
        <div className="text-center">
          <p className="mb-3 text-destructive">{error || "Job not found"}</p>
          <Link href="/jobs" className="text-sm font-semibold text-[#0d93a1] hover:underline">← Back to Jobs</Link>
        </div>
      </div>
    )
  }

  // On-sheet contacts and schedule lines fall back to showing everything when
  // nothing has been flagged, so a sheet is never blank.
  const sheetContacts = (() => {
    const flagged = job.jobContacts?.filter((jc) => jc.jobsheet) ?? []
    return flagged.length ? flagged : job.jobContacts ?? []
  })()
  const scheduleLines = (() => {
    const flagged = events.filter((e) => e.print)
    return flagged.length ? flagged : events
  })()

  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <div className="min-h-screen bg-[#e9ecee] text-[#0f1b24] print:bg-white">
      {/* Toolbar — screen only */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#e3e6e9] bg-white px-5 py-3 print:hidden">
        <Link href={`/jobs/${params.id}`} className="inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-[15px]" /> Back to job {job.enquiry_id}
        </Link>
        <span className="text-[0.85rem] font-semibold text-[#41525e]">Job sheet preview</span>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-[9px] border border-primary bg-primary px-4 py-2 text-[0.85rem] font-semibold text-white hover:bg-[#0d93a1]"
        >
          <Printer className="size-[15px]" /> Print
        </button>
      </div>

      {/* A4 sheet */}
      <div className="flex justify-center p-7 print:p-0">
        <div className="w-[820px] max-w-full rounded-sm bg-white p-10 shadow-[0_8px_30px_rgba(16,24,40,.14)] print:w-full print:max-w-full print:rounded-none print:p-0 print:shadow-none">
          {/* Header */}
          <div className="flex items-start justify-between pb-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-[34px] place-items-center rounded-lg bg-gradient-to-br from-primary to-[#0d93a1] text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M2 11c1.6 0 2.6-1.6 5-1.6S14 11 16 11s2.6-1.6 5-1.6" />
                  <path d="M2 16c1.6 0 2.6-1.6 5-1.6S14 16 16 16s2.6-1.6 5-1.6" />
                </svg>
              </span>
              <span className="text-[1.05rem] font-bold italic leading-[1.05]">
                Aquatic <span className="text-[#0d93a1]">Solutions</span>
                <small className="mt-0.5 block text-[0.58rem] font-semibold not-italic tracking-[0.16em] text-muted-foreground/70">UK</small>
              </span>
            </div>
          </div>
          <div className="mb-6 h-[3px] rounded bg-primary" />

          {/* Title row */}
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="text-[0.7rem] font-bold tracking-[0.14em] text-muted-foreground">JOB SHEET</div>
              <div className="text-[2.4rem] font-bold leading-none tracking-tight tabular-nums">{job.enquiry_id}</div>
            </div>
            <div className="max-w-[62%] rounded-lg bg-primary px-[1.1rem] py-[0.7rem] text-right text-[0.95rem] font-semibold text-white">
              {[job.client?.business_name, job.project_name].filter(Boolean).join(" — ") || "—"}
            </div>
          </div>

          {/* Client + Site */}
          <div className="mb-4 grid grid-cols-[1fr_1.25fr] gap-4">
            <div className="rounded-lg border border-[#e3e6e9] px-4 py-3.5">
              <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Client</div>
              <div className="text-[1rem] font-bold">{job.client?.business_name || "—"}</div>
            </div>
            <div className="rounded-lg border border-[#e3e6e9] px-4 py-3.5">
              <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Site</div>
              <div className="text-[1rem] font-bold">{job.site || job.project_name || "—"}</div>
              {job.site_pcode && <div className="mt-2 text-[1.5rem] font-bold leading-tight">{job.site_pcode}</div>}
              <div className="mt-2.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">what3words</div>
              <div className="font-mono text-[1.1rem] font-bold text-[#0d93a1]">— not captured yet —</div>
            </div>
          </div>

          {/* Roles grid */}
          <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-[#e3e6e9] px-4 py-3.5">
            {[
              ["Contract Manager", "—"],
              ["Job Type", job.job_type?.job_type || "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="mb-1 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
                <div className={`text-[0.9rem] font-semibold ${value === "—" ? "text-muted-foreground/50" : ""}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Contacts */}
          {sheetContacts.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Site contacts</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-lg border border-[#e3e6e9] px-4 py-3.5">
                {sheetContacts.map((jc) => (
                  <div key={jc.id}>
                    <div className="font-bold">{contactName(jc)}{(jc.title || jc.contact?.title) && <span className="font-normal"> · {jc.title || jc.contact?.title}</span>}</div>
                    <div className="text-[0.9rem] text-[#41525e]">{jc.contact?.mobile || jc.contact?.tel || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description of work */}
          <div className="mb-4">
            <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Description of work</div>
            <div className="rounded-lg border border-[#e3e6e9] px-4 py-3.5 text-[0.88rem] leading-relaxed text-[#41525e]">
              {job.notes || <span className="text-muted-foreground/50">No description recorded</span>}
            </div>
          </div>

          {/* Operator instructions — highlighted */}
          {job.sheetnote && (
            <div className="mb-4 rounded-lg border-[1.5px] border-[#d23b3b] bg-[#fdeaea] px-4 py-3.5">
              <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[#d23b3b]">★ Operator instructions — read before arrival</div>
              <div className="text-[0.9rem] font-medium leading-relaxed text-[#7a2020]">{job.sheetnote}</div>
            </div>
          )}

          {/* Schedule */}
          <div className="mb-4">
            <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Schedule</div>
            <table className="w-full overflow-hidden rounded-lg border border-[#e3e6e9] text-[0.84rem]">
              <thead>
                <tr className="bg-[#fafbfc]">
                  <th className="border-b border-[#e3e6e9] px-3 py-2 text-left text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">Start</th>
                  <th className="border-b border-[#e3e6e9] px-3 py-2 text-left text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">Finish</th>
                  <th className="border-b border-[#e3e6e9] px-3 py-2 text-right text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">Days</th>
                </tr>
              </thead>
              <tbody>
                {scheduleLines.length === 0 ? (
                  <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No scheduled work lines</td></tr>
                ) : (
                  scheduleLines.map((e) => (
                    <tr key={e.task_id} className="border-b border-[#f0f2f4] last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 text-[#41525e]">{fmtDate(e.start_date)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-[#41525e]">{fmtDate(e.date)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{e.man_days ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Site location placeholder */}
          <div className="mb-4">
            <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Site location</div>
            <div className="grid h-[180px] place-items-center rounded-lg border border-[#e3e6e9] bg-[repeating-linear-gradient(0deg,#eef1f3,#eef1f3_26px,#e7ebed_26px,#e7ebed_27px),repeating-linear-gradient(90deg,#eef1f3,#eef1f3_26px,#e7ebed_26px,#e7ebed_27px)] text-[0.72rem] text-muted-foreground">
              Location map — auto-generated from what3words (coming soon)
            </div>
          </div>

          {/* Sign-off */}
          <div className="mt-8 grid grid-cols-3 gap-8">
            {["Operator", "Client", "Date"].map((label) => (
              <div key={label}>
                <div className="h-[34px] border-b border-[#41525e]" />
                <div className="mt-1.5 text-[0.7rem] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center text-[0.66rem] text-muted-foreground/70">
            Aquatic Solutions UK · Job sheet {job.enquiry_id} · generated {today}
          </div>
        </div>
      </div>
    </div>
  )
}
