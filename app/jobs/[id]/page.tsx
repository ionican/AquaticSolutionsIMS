"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Printer, Plus, Pencil, Trash2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Job {
  id: number
  enquiry_id: number
  project_name: string
  site: string
  site_pcode: string
  status: string
  enquiry_date: string
  contract_start: string
  contract_end: string
  quotation_date: string
  quotation_value: number
  ordervalue: number
  order_number: string
  nature: string
  source: string
  notes: string
  sqm: string
  guarantee: string
  operative: string
  cagm: number | string | null
  sheetnote: string
  client: {
    client_id: number
    business_name: string
    address1: string
    address2: string
    town: string
    county: string
    pcode: string
    web_site: string
  } | null
  contact: {
    contact_id: number
    fname: string
    sname: string
    tel: string
    mobile: string
    email: string
    title: string
  } | null
  jobContacts: JobContact[]
  job_type: { job_type_id: number; job_type: string } | null
  job_class: { job_class_id: number; job_class: string } | null
}

interface JobContact {
  id: number
  company_id: number | null
  enquiry_id: number
  contact_id: number
  title: string | null
  invoice: boolean | null
  jobsheet: boolean | null
  prenotification: boolean | null
  contact: {
    contact_id: number
    fname: string | null
    sname: string | null
    tel: string | null
    mobile: string | null
    email: string | null
    title: string | null
  } | null
}

interface Event {
  id: number
  task_id: number
  task_name: string
  date: string
  start_date: string
  man_days: number
  resource: string
  completed: boolean
  invoice_value: number
  invoicable: boolean
  eventtype: string
  warranty: boolean
  inv_ref: string | null
  print: boolean
}

interface EventForm {
  task_name: string
  date: string
  start_date: string
  man_days: string
  invoice_value: string
  completed: boolean
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "plan", label: "Project Plan" },
  { id: "clientsite", label: "Client & Site" },
  { id: "contacts", label: "Contacts" },
  { id: "documents", label: "Documents" },
  { id: "journal", label: "Journal" },
]

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

// The date columns arrive as ISO timestamps ("2013-07-01T00:00:00"); an
// <input type="date"> needs a bare "YYYY-MM-DD".
function toDateInput(val: string | null): string {
  return val ? val.slice(0, 10) : ""
}

const BLANK_EVENT_FORM: EventForm = {
  task_name: "", date: "", start_date: "",
  man_days: "", invoice_value: "", completed: false,
}

// The API returns events ordered by date ascending; keep the local list in the
// same order after add/edit. ISO date strings sort lexically = chronologically.
function byDate(a: Event, b: Event) {
  return (a.date || "￿").localeCompare(b.date || "￿")
}

function fmtDate(val: string | null) {
  if (!val) return "—"
  return new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtGBP(val: number | null | undefined) {
  if (val == null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(val)
}

function contactName(jc: JobContact) {
  const c = jc.contact
  if (!c) return `Contact #${jc.contact_id}`
  return [c.title, c.fname, c.sname].filter(Boolean).join(" ") || `Contact #${jc.contact_id}`
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-block rounded-md px-2 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide", STATUS_PILL[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  )
}

function Field({ label, children, hint }: { label: string; children?: React.ReactNode; hint?: string }) {
  const empty = children == null || children === "" || children === "—"
  return (
    <div>
      <div className="mb-1 text-[0.72rem] font-medium text-muted-foreground">{label}</div>
      <div className="min-h-[34px] rounded-lg border border-border bg-white px-2.5 py-1.5 text-[0.86rem] text-foreground">
        {empty ? <span className="text-muted-foreground/50">—</span> : children}
      </div>
      {hint && <div className="mt-1 text-[0.66rem] text-muted-foreground/70">{hint}</div>}
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-[#fafbfc] px-[1.05rem] py-[0.82rem]">
        <span className="text-[0.72rem] font-bold uppercase tracking-[0.07em] text-secondary-foreground">{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

// A read-only tick / dash used in the Contacts and Project Plan tables.
function Tick({ on }: { on: boolean | null | undefined }) {
  return on
    ? <Check className="mx-auto size-4 text-primary" />
    : <span className="text-muted-foreground/40">—</span>
}

const thBase = "px-3 py-2.5 text-left text-[0.64rem] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap"

export default function JobDetailPage() {
  const params = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState("overview")
  const [toast, setToast] = useState("")

  // Event add/edit/delete state (preserved from the original page)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [form, setForm] = useState<EventForm>(BLANK_EVENT_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Event | null>(null)
  const [rowBusy, setRowBusy] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    window.clearTimeout((flash as unknown as { t?: number }).t)
    ;(flash as unknown as { t?: number }).t = window.setTimeout(() => setToast(""), 2600)
  }

  function openAdd() {
    setEditing(null)
    setForm(BLANK_EVENT_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(event: Event) {
    setEditing(event)
    setForm({
      task_name: event.task_name ?? "",
      date: toDateInput(event.date),
      start_date: toDateInput(event.start_date),
      man_days: event.man_days == null ? "" : String(event.man_days),
      invoice_value: event.invoice_value == null ? "" : String(event.invoice_value),
      completed: !!event.completed,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function saveEvent() {
    if (!job) return
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch(editing ? `/api/events/${editing.id}` : "/api/events", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? form : { ...form, enquiry_id: job.enquiry_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save event")
      setEvents(evs => {
        const next = editing ? evs.map(e => (e.id === editing.id ? data.event : e)) : [...evs, data.event]
        return next.sort(byDate)
      })
      setDialogOpen(false)
      setEditing(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save event")
    } finally {
      setSaving(false)
    }
  }

  // Inline "Done" toggle — marks an event completed (feeds the invoicing flow).
  async function toggleDone(event: Event) {
    setRowBusy(event.id)
    setActionError(null)
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !event.completed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update event")
      setEvents(evs => evs.map(e => (e.id === event.id ? data.event : e)).sort(byDate))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update event")
    } finally {
      setRowBusy(null)
    }
  }

  async function confirmDelete() {
    const target = pendingDelete
    if (!target) return
    setRowBusy(target.id)
    setActionError(null)
    try {
      const res = await fetch(`/api/events/${target.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete event")
      setEvents(evs => evs.filter(e => e.id !== target.id))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete event")
    } finally {
      setRowBusy(null)
      setPendingDelete(null)
    }
  }

  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await fetch(`/api/jobs/${params.id}`)
        if (!res.ok) throw new Error("Job not found")
        const data = await res.json()
        setJob(data.job)
        setEvents(data.events)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load job")
      } finally {
        setLoading(false)
      }
    }
    fetchJob()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-[1320px] px-6 py-7">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 rounded bg-muted" />
            <div className="h-72 rounded-xl bg-muted" />
          </div>
        </main>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-[1320px] px-6 py-7">
          <div className="py-16 text-center">
            <p className="mb-4 text-destructive">{error || "Job not found"}</p>
            <Link href="/jobs" className="text-[0.85rem] font-semibold text-[#0d93a1] hover:underline">← Back to Jobs</Link>
          </div>
        </main>
      </div>
    )
  }

  const totalDays = events.reduce((s, e) => s + (e.man_days || 0), 0)
  const totalValue = events.reduce((s, e) => s + (e.invoice_value || 0), 0)

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-[1320px] px-6 py-5">
        {/* Breadcrumb */}
        <div className="mb-2 text-[0.8rem] text-muted-foreground">
          <Link href="/jobs" className="text-[#0d93a1] hover:underline">Jobs</Link> / {job.enquiry_id}
        </div>

        {/* Job header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-[1.5rem] font-bold tracking-tight">
              Job {job.enquiry_id} · {job.client?.business_name || job.project_name || "Untitled"}
              {job.status && <StatusPill status={job.status} />}
            </h1>
            <p className="mt-1.5 text-[0.85rem] text-muted-foreground">
              {[job.project_name, job.job_type?.job_type, job.contract_start && `Starts ${fmtDate(job.contract_start)}`, job.contract_end && `Ends ${fmtDate(job.contract_end)}`]
                .filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => flash("Print job sheet — the job sheet screen is coming next")}
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-white px-[0.85rem] py-2 text-[0.83rem] font-semibold shadow-sm transition-colors hover:bg-[#fafbfc]"
            >
              <Printer className="size-[15px]" /> Print job sheet
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-6 mt-4 flex gap-1 border-b border-border">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px border-b-[2.5px] px-3.5 py-2.5 text-[0.88rem] font-medium transition-colors",
                tab === t.id ? "border-primary font-semibold text-[#0d93a1]" : "border-transparent text-[#41525e] hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {actionError && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</div>
        )}

        {/* ===================== OVERVIEW ===================== */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 gap-[1.1rem] lg:grid-cols-[1.62fr_1fr] items-start">
            <div className="flex flex-col gap-[1.1rem]">
              <Panel title="Job summary">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 p-[1.05rem] sm:grid-cols-3">
                  <Field label="Project name">{job.project_name}</Field>
                  <Field label="Job type">{job.job_type?.job_type}</Field>
                  <Field label="Status">{job.status}</Field>
                  <Field label="Order value">{fmtGBP(job.ordervalue)}</Field>
                  <Field label="Job class">{job.job_class?.job_class}</Field>
                  <Field label="Client order no.">{job.order_number}</Field>
                  <Field label="Project start date">{fmtDate(job.contract_start)}</Field>
                  <Field label="Project end date">{fmtDate(job.contract_end)}</Field>
                  <Field label="Site postcode">{job.site_pcode}</Field>
                  <Field label="Source">{job.source}</Field>
                </div>
              </Panel>

              <Panel title="Description of work">
                <div className="space-y-4 p-[1.05rem]">
                  <Field label="Scope of works">{job.notes}</Field>
                  <Field label="Operator instructions (prints on job sheet)">{job.sheetnote}</Field>
                </div>
              </Panel>

              <Panel title="Photos" action={<button onClick={() => flash("Photo upload — coming soon")} className="text-[0.74rem] font-semibold text-[#0d93a1] hover:underline">+ Add</button>}>
                <div className="p-[1.05rem] text-center text-[0.82rem] text-muted-foreground">
                  No photos yet — uploading will come with the Documents feature.
                </div>
              </Panel>
            </div>

            <div className="flex flex-col gap-[1.1rem]">
              <Panel title="Site & access">
                <div className="space-y-3.5 p-[1.05rem]">
                  <Field label="Site address">{[job.site, job.site_pcode].filter(Boolean).join(", ")}</Field>
                  <Field label="what3words" hint="Not captured yet — will pinpoint the working area">{null}</Field>
                  <div className="grid h-[150px] place-items-center rounded-lg border border-border bg-[repeating-linear-gradient(45deg,#f1f3f5,#f1f3f5_11px,#e9ecef_11px,#e9ecef_22px)] text-[0.78rem] text-muted-foreground">
                    Site map — coming with what3words
                  </div>
                </div>
              </Panel>

              <Panel title="Notes & follow-ups">
                <div className="p-[1.05rem] text-[0.82rem] text-muted-foreground">
                  A notes &amp; follow-up timeline will live here. For now, see the job&apos;s work lines under <button onClick={() => setTab("plan")} className="font-semibold text-[#0d93a1] hover:underline">Project Plan</button>.
                </div>
              </Panel>
            </div>
          </div>
        )}

        {/* ===================== PROJECT PLAN ===================== */}
        {tab === "plan" && (
          <Panel
            title="Project plan · the central work list"
            action={
              <button onClick={openAdd} className="inline-flex items-center gap-1 text-[0.74rem] font-semibold text-[#0d93a1] hover:underline">
                <Plus className="size-3.5" /> Add line
              </button>
            }
          >
            <div className="border-b border-border px-[1.05rem] py-2 text-[0.78rem] text-muted-foreground">
              {events.length} line{events.length === 1 ? "" : "s"} · {totalDays} days planned · {fmtGBP(totalValue)} net
              <span className="ml-2 text-[0.72rem]">Tick <b>Done</b> when a line is finished — it becomes ready to invoice.</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[0.8rem]">
                <thead>
                  <tr className="border-b border-border bg-[#fafbfc]">
                    <th className={cn(thBase, "text-center")}>Done</th>
                    <th className={thBase}>Description</th>
                    <th className={thBase}>Start</th>
                    <th className={thBase}>Finish</th>
                    <th className={cn(thBase, "text-right")}>Days</th>
                    <th className={cn(thBase, "text-right")}>Value</th>
                    <th className={thBase}>Invoice</th>
                    <th className={cn(thBase, "text-center")}>On sheet</th>
                    <th className={cn(thBase, "text-right")}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No lines yet</td></tr>
                  ) : (
                    events.map(event => (
                      <tr key={event.task_id} className="border-b border-[#eef1f3] last:border-0 hover:bg-[#f7fbfc]">
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => toggleDone(event)}
                            disabled={rowBusy === event.id}
                            title={event.completed ? "Marked done — click to undo" : "Mark done"}
                            className={cn(
                              "grid size-[18px] place-items-center rounded-[5px] border transition-colors",
                              event.completed ? "border-primary bg-primary text-white" : "border-border bg-white hover:border-primary"
                            )}
                          >
                            {event.completed && <Check className="size-3" />}
                          </button>
                        </td>
                        <td className="max-w-[280px] px-3 py-2 text-foreground">
                          <div className="truncate" title={event.task_name}>{event.task_name || <span className="italic text-muted-foreground">Untitled line</span>}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDate(event.start_date)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDate(event.date)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{event.man_days ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{fmtGBP(event.invoice_value)}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {event.inv_ref
                            ? <span className="inline-block rounded-md bg-[#eef1f4] px-2 py-0.5 text-[0.64rem] font-bold uppercase tracking-wide text-[#54636f]">Invoiced {event.inv_ref}</span>
                            : event.completed
                              ? <span className="inline-block rounded-md bg-[#fcefd2] px-2 py-0.5 text-[0.64rem] font-bold uppercase tracking-wide text-[#946312]">Ready</span>
                              : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center"><Tick on={event.print} /></td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(event)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.74rem] font-semibold text-[#0d93a1] hover:bg-[#e0f3f5]">
                              <Pencil className="size-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => { setActionError(null); setPendingDelete(event) }}
                              disabled={rowBusy === event.id}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.74rem] font-semibold text-destructive hover:bg-[#fdecec]"
                            >
                              <Trash2 className="size-3.5" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {events.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-border bg-[#fafbfc] font-bold text-foreground">
                      <td colSpan={4} className="px-3 py-2.5 text-right text-[0.72rem] uppercase tracking-wide text-muted-foreground">Totals</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{totalDays}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtGBP(totalValue)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Panel>
        )}

        {/* ===================== CLIENT & SITE ===================== */}
        {tab === "clientsite" && (
          <div className="grid grid-cols-1 gap-[1.1rem] lg:grid-cols-2 items-start">
            <Panel title="Client">
              <div className="p-[1.05rem]">
                {job.client ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                    <div className="col-span-2"><Field label="Business name">{job.client.business_name}</Field></div>
                    <div className="col-span-2"><Field label="Registered address">{[job.client.address1, job.client.address2, job.client.town, job.client.county, job.client.pcode].filter(Boolean).join(", ")}</Field></div>
                    <Field label="Website">{job.client.web_site ? <a href={job.client.web_site} target="_blank" rel="noopener noreferrer" className="text-[#0d93a1] hover:underline">{job.client.web_site}</a> : null}</Field>
                    <Field label="Client order no.">{job.order_number}</Field>
                  </div>
                ) : (
                  <p className="text-[0.85rem] text-muted-foreground">No client assigned</p>
                )}
              </div>
            </Panel>

            <Panel title="Site & access">
              <div className="space-y-3.5 p-[1.05rem]">
                <Field label="Site name / address">{job.site}</Field>
                <Field label="Site postcode">{job.site_pcode}</Field>
                <Field label="what3words" hint="Not captured yet">{null}</Field>
              </div>
            </Panel>
          </div>
        )}

        {/* ===================== CONTACTS ===================== */}
        {tab === "contacts" && (
          <Panel title="Contacts">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[0.82rem]">
                <thead>
                  <tr className="border-b border-border bg-[#fafbfc]">
                    <th className={thBase}>Name</th>
                    <th className={thBase}>Role</th>
                    <th className={thBase}>Phone</th>
                    <th className={thBase}>Email</th>
                    <th className={cn(thBase, "text-center")}>Invoice</th>
                    <th className={cn(thBase, "text-center")}>On sheet</th>
                    <th className={cn(thBase, "text-center")}>Pre-notify</th>
                  </tr>
                </thead>
                <tbody>
                  {job.jobContacts?.length ? (
                    job.jobContacts.map(jc => (
                      <tr key={jc.id} className="border-b border-[#eef1f3] last:border-0 hover:bg-[#f7fbfc]">
                        <td className="px-3 py-2 font-medium text-foreground">{contactName(jc)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{jc.title || jc.contact?.title || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{jc.contact?.mobile || jc.contact?.tel || "—"}</td>
                        <td className="px-3 py-2">
                          {jc.contact?.email
                            ? <a href={`mailto:${jc.contact.email}`} className="text-[#0d93a1] hover:underline">{jc.contact.email}</a>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center"><Tick on={jc.invoice} /></td>
                        <td className="px-3 py-2 text-center"><Tick on={jc.jobsheet} /></td>
                        <td className="px-3 py-2 text-center"><Tick on={jc.prenotification} /></td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No contacts on this job</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#eef1f3] bg-[#fafbfc] px-[1.05rem] py-2.5 text-[0.72rem] leading-relaxed text-muted-foreground">
              <b>Invoice</b> — receives the invoice · <b>On sheet</b> — shown on the printed job sheet · <b>Pre-notify</b> — emailed the day before we arrive.
            </div>
          </Panel>
        )}

        {/* ===================== DOCUMENTS ===================== */}
        {tab === "documents" && (
          <Panel title="Documents" action={<button onClick={() => flash("Document upload — coming soon")} className="text-[0.74rem] font-semibold text-[#0d93a1] hover:underline">+ Upload</button>}>
            <div className="p-[1.05rem]">
              <div className="grid place-items-center rounded-lg border border-dashed border-border px-4 py-10 text-center text-[0.84rem] text-muted-foreground">
                Site plans, drawings, risk assessments and photos will live here.<br />Document storage is coming soon.
              </div>
            </div>
          </Panel>
        )}

        {/* ===================== JOURNAL ===================== */}
        {tab === "journal" && (
          <Panel title="Journal">
            <div className="p-[1.05rem] text-[0.84rem] text-muted-foreground">
              A running journal of what happened on this job (notes, status changes) will appear here. Coming soon.
            </div>
          </Panel>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-[10px] bg-foreground px-4 py-2.5 text-[0.82rem] text-background shadow-lg">
          {toast}
        </div>
      )}

      {/* Add / edit event dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); setEditing(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit line" : "Add line"}</DialogTitle>
            <DialogDescription>{editing ? "Update this work line." : "Add a new line to the project plan."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="task_name">Description</Label>
              <Input id="task_name" value={form.task_name} onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="start_date">Start</Label>
                <Input id="start_date" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="date">Finish</Label>
                <Input id="date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="man_days">Days</Label>
                <Input id="man_days" type="number" step="any" value={form.man_days} onChange={e => setForm(f => ({ ...f, man_days: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invoice_value">Value (£)</Label>
                <Input id="invoice_value" type="number" step="any" value={form.invoice_value} onChange={e => setForm(f => ({ ...f, invoice_value: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <Checkbox checked={form.completed} onCheckedChange={v => setForm(f => ({ ...f, completed: v === true }))} /> Done
              </label>
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null) }} disabled={saving}>Cancel</Button>
            <Button onClick={saveEvent} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add line"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={o => { if (!o) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this line?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.task_name ? `"${pendingDelete.task_name}"` : "This line"} will be permanently removed from the job. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
