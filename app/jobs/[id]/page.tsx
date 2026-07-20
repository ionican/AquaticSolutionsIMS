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
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Calendar, PoundSterling, User, Building2, Phone, Mail, FileText, Clock, Pencil, Plus, Trash2 } from "lucide-react"
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
  inv_name: string
  inv_addr1: string
  inv_addr2: string
  inv_town: string
  inv_pcode: string
  inv_email: string
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
}

interface EventForm {
  task_name: string
  date: string
  start_date: string
  eventtype: string
  resource: string
  man_days: string
  invoice_value: string
  invoicable: boolean
  completed: boolean
  warranty: boolean
}

// The date columns arrive as ISO timestamps ("2013-07-01T00:00:00"); an
// <input type="date"> needs a bare "YYYY-MM-DD".
function toDateInput(val: string | null): string {
  if (!val) return ""
  return val.slice(0, 10)
}

const BLANK_EVENT_FORM: EventForm = {
  task_name: "", date: "", start_date: "", eventtype: "", resource: "",
  man_days: "", invoice_value: "", invoicable: false, completed: false, warranty: false,
}

// The API returns events ordered by date ascending; keep the local list in the
// same order after add/edit. ISO date strings sort lexically = chronologically;
// blank dates sort last.
function byDate(a: Event, b: Event) {
  return (a.date || "￿").localeCompare(b.date || "￿")
}

const STATUS_COLORS: Record<string, string> = {
  "Contact":    "bg-amber-100 text-amber-800 border-amber-200",
  "Enquiry":    "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Quoting":    "bg-orange-100 text-orange-800 border-orange-200",
  "Quoted":     "bg-blue-100 text-blue-800 border-blue-200",
  "Contracted": "bg-green-100 text-green-800 border-green-200",
  "Lost":       "bg-red-100 text-red-800 border-red-200",
  "Completed":  "bg-gray-100 text-gray-700 border-gray-200",
}

function formatDate(val: string | null) {
  if (!val) return "—"
  return new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function formatCurrency(val: number | null) {
  if (val == null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(val)
}

function contactName(jobContact: JobContact) {
  const contact = jobContact.contact
  if (!contact) return `Contact #${jobContact.contact_id}`
  const displayName = [contact.title, contact.fname, contact.sname].filter(Boolean).join(" ")
  return displayName || `Contact #${jobContact.contact_id}`
}

function DataField({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  )
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [form, setForm] = useState<EventForm>(BLANK_EVENT_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<Event | null>(null)
  const [rowBusy, setRowBusy] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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
      eventtype: event.eventtype ?? "",
      resource: event.resource ?? "",
      man_days: event.man_days == null ? "" : String(event.man_days),
      invoice_value: event.invoice_value == null ? "" : String(event.invoice_value),
      invoicable: !!event.invoicable,
      completed: !!event.completed,
      warranty: !!event.warranty,
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
        const next = editing
          ? evs.map(e => (e.id === editing.id ? data.event : e))
          : [...evs, data.event]
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
        <main className="mx-auto max-w-6xl px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </main>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-6xl px-4 py-6">
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error || "Job not found"}</p>
            <Button variant="outline" onClick={() => router.push("/jobs")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Jobs
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const statusClass = STATUS_COLORS[job.status] ?? "bg-muted text-muted-foreground border-border"

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/jobs")} className="h-8 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">#{job.enquiry_id}</span>
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", statusClass)}>
                  {job.status}
                </span>
              </div>
              <h1 className="text-xl font-bold text-foreground mt-0.5">
                {job.project_name || "Untitled Project"}
              </h1>
            </div>
          </div>
        </div>

        {/* Job Details - Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Main Info */}
          <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Project Details
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3">
              <DataField label="Site" value={job.site} icon={MapPin} />
              <DataField label="Postcode" value={job.site_pcode} />
              <DataField label="Type" value={job.job_type?.job_type} />
              <DataField label="Class" value={job.job_class?.job_class} />
              <DataField label="Nature" value={job.nature} />
              <DataField label="Source" value={job.source} />
              <DataField label="Order No" value={job.order_number} />
              <DataField label="Guarantee" value={job.guarantee} />
              <DataField label="SQM" value={job.sqm} />
              <DataField label="Operative" value={job.operative} />
            </div>

            {/* Dates Row */}
            <div className="mt-4 pt-3 border-t border-border">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Key Dates
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                <DataField label="Enquiry" value={formatDate(job.enquiry_date)} />
                <DataField label="Quotation" value={formatDate(job.quotation_date)} />
                <DataField label="Start" value={formatDate(job.contract_start)} />
                <DataField label="End" value={formatDate(job.contract_end)} />
              </div>
            </div>

            {/* Values Row */}
            <div className="mt-4 pt-3 border-t border-border">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <PoundSterling className="h-3 w-3" /> Values
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                <DataField label="Quote Value" value={formatCurrency(job.quotation_value)} />
                <DataField label="Order Value" value={formatCurrency(job.ordervalue)} />
              </div>
            </div>

            {/* Notes */}
            {job.sheetnote && (
              <div className="mt-4 pt-3 border-t border-border">
                <h3 className="text-xs font-semibold text-muted-foreground mb-1">Sheet Note</h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">{job.sheetnote}</p>
              </div>
            )}
          </div>

          {/* Client & Contact */}
          <div className="space-y-4">
            {/* Client Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Client
              </h2>
              {job.client ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{job.client.business_name}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {[job.client.address1, job.client.address2, job.client.town, job.client.county, job.client.pcode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {job.client.web_site && (
                    <a href={job.client.web_site} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      {job.client.web_site}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No client assigned</p>
              )}
            </div>

            {/* Contact Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <User className="h-4 w-4" /> Contacts ({job.jobContacts?.length || 0})
              </h2>
              {job.jobContacts?.length ? (
                <div className="space-y-3">
                  {job.jobContacts.map((jobContact) => (
                    <div key={jobContact.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{contactName(jobContact)}</p>
                          {jobContact.title && (
                            <p className="text-xs text-muted-foreground">{jobContact.title}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          {jobContact.jobsheet && (
                            <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                              Jobsheet
                            </span>
                          )}
                          {jobContact.invoice && (
                            <span className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                              Invoice
                            </span>
                          )}
                          {jobContact.prenotification && (
                            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              Pre-notify
                            </span>
                          )}
                        </div>
                      </div>
                      {jobContact.contact?.tel && (
                        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {jobContact.contact.tel}
                        </p>
                      )}
                      {jobContact.contact?.mobile && (
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {jobContact.contact.mobile}
                        </p>
                      )}
                      {jobContact.contact?.email && (
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <a href={`mailto:${jobContact.contact.email}`} className="text-primary hover:underline">
                            {jobContact.contact.email}
                          </a>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : job.contact ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {[job.contact.title, job.contact.fname, job.contact.sname].filter(Boolean).join(" ")}
                  </p>
                  {job.contact.tel && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {job.contact.tel}
                    </p>
                  )}
                  {job.contact.mobile && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {job.contact.mobile}
                    </p>
                  )}
                  {job.contact.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <a href={`mailto:${job.contact.email}`} className="text-primary hover:underline">{job.contact.email}</a>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No contacts assigned</p>
              )}
            </div>
          </div>
        </div>

        {/* Events Section */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Events ({events.length})
            </h2>
            <Button size="sm" className="h-8 px-2" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Add event
            </Button>
          </div>
          {actionError && (
            <div className="mx-4 mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Task</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Resource</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Days</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Value</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Billable</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Done</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                      No events recorded
                    </td>
                  </tr>
                ) : (
                  events.map((event, i) => (
                    <tr
                      key={event.task_id}
                      className={cn(
                        "border-b border-border last:border-0",
                        i % 2 === 0 ? "bg-background" : "bg-muted/20"
                      )}
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(event.date)}</td>
                      <td className="px-3 py-2 text-foreground max-w-[200px] truncate" title={event.task_name}>
                        {event.task_name}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{event.eventtype}</td>
                      <td className="px-3 py-2 text-muted-foreground">{event.resource}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {event.man_days ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(event.invoice_value)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {event.invoicable ? (
                          <span className="inline-block w-4 h-4 rounded-full bg-green-500" title="Billable" />
                        ) : (
                          <span className="inline-block w-4 h-4 rounded-full bg-gray-300" title="Non-billable" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {event.completed ? (
                          <span className="inline-block w-4 h-4 rounded-full bg-green-500" title="Completed" />
                        ) : (
                          <span className="inline-block w-4 h-4 rounded-full bg-gray-300" title="Pending" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(event)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="ghost" size="sm" disabled={rowBusy === event.id}
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => { setActionError(null); setPendingDelete(event) }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); setEditing(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit event" : "Add event"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this event's details." : "Add a new event to this job."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="task_name">Task</Label>
              <Input id="task_name" value={form.task_name}
                onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="start_date">Start date</Label>
                <Input id="start_date" type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="eventtype">Type</Label>
                <Input id="eventtype" value={form.eventtype}
                  onChange={e => setForm(f => ({ ...f, eventtype: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="resource">Resource</Label>
                <Input id="resource" value={form.resource}
                  onChange={e => setForm(f => ({ ...f, resource: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="man_days">Days</Label>
                <Input id="man_days" type="number" step="any" value={form.man_days}
                  onChange={e => setForm(f => ({ ...f, man_days: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invoice_value">Value (£)</Label>
                <Input id="invoice_value" type="number" step="any" value={form.invoice_value}
                  onChange={e => setForm(f => ({ ...f, invoice_value: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox checked={form.invoicable}
                  onCheckedChange={v => setForm(f => ({ ...f, invoicable: v === true }))} />
                Billable
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox checked={form.completed}
                  onCheckedChange={v => setForm(f => ({ ...f, completed: v === true }))} />
                Completed
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox checked={form.warranty}
                  onCheckedChange={v => setForm(f => ({ ...f, warranty: v === true }))} />
                Warranty
              </label>
            </div>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null) }} disabled={saving}>Cancel</Button>
            <Button onClick={saveEvent} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={o => { if (!o) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.task_name ? `"${pendingDelete.task_name}"` : "This event"} will be permanently
              removed from the job. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
