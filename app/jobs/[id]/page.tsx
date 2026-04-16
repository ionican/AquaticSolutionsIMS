"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Calendar, PoundSterling, User, Building2, Phone, Mail, FileText, Clock } from "lucide-react"
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
  job_type: { job_type_id: number; job_type: string } | null
  job_class: { job_class_id: number; job_class: string } | null
}

interface JobContact {
  id: number
  enquiry_id: number
  contact_id: number
  title: string
  invoice: boolean | null
  jobsheet: boolean | null
  contact: {
    contact_id: number
    fname: string
    sname: string
    tel: string
    mobile: string
    email: string
    title: string
  } | null
}

interface Event {
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
  const [jobContacts, setJobContacts] = useState<JobContact[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await fetch(`/api/jobs/${params.id}`)
        if (!res.ok) throw new Error("Job not found")
        const data = await res.json()
        setJob(data.job)
        setJobContacts(data.jobContacts || [])
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

            {/* Contacts Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <User className="h-4 w-4" /> Contacts ({jobContacts.length})
              </h2>
              {jobContacts.length > 0 ? (
                <div className="space-y-3">
                  {jobContacts.map((jc) => (
                    <div key={jc.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {jc.title}
                        </span>
                        {jc.jobsheet && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                            Jobsheet
                          </span>
                        )}
                        {jc.invoice && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            Invoice
                          </span>
                        )}
                      </div>
                      {jc.contact ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {[jc.contact.title, jc.contact.fname, jc.contact.sname].filter(Boolean).join(" ")}
                          </p>
                          {jc.contact.tel && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {jc.contact.tel}
                            </p>
                          )}
                          {jc.contact.mobile && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {jc.contact.mobile}
                            </p>
                          )}
                          {jc.contact.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <a href={`mailto:${jc.contact.email}`} className="text-primary hover:underline">{jc.contact.email}</a>
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Contact #{jc.contact_id} not found</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No contacts assigned</p>
              )}
            </div>
          </div>
        </div>

        {/* Events Section */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Events ({events.length})
            </h2>
          </div>
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
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
