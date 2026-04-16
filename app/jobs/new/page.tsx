"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Save, Search, X, ChevronDown, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

// Wrapper to handle Suspense for useSearchParams
export default function NewJobPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-4xl mx-auto py-8 px-4">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    }>
      <NewJobPageContent />
    </Suspense>
  )
}

const JOB_STATUSES = ["Contact", "Enquiry", "Quoting", "Quoted", "Contracted", "Completed", "Lost"]

interface Client {
  client_id: number
  business_name: string
  contact_count: number
}

interface Contact {
  contact_id: number
  fname: string
  sname: string
  client_id: number
}

interface JobContactRow {
  key: string
  contact_id: string
  title: string
  jobsheet: boolean
  invoice: boolean
}

interface JobType {
  job_type_id: number
  job_type: string
}

interface JobClass {
  job_class_id: number
  job_class: string
}

// Searchable combobox component for clients
function ClientCombobox({
  clients,
  value,
  onChange,
  hasError,
}: {
  clients: Client[]
  value: string
  onChange: (val: string) => void
  hasError?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = clients.find(c => String(c.client_id) === value)

  const filtered = clients.filter(c =>
    c.business_name?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleSelect = (clientId: string) => {
    onChange(clientId)
    setOpen(false)
    setSearch("")
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange("")
    setSearch("")
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background transition-colors",
          "hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-ring",
          !selected && "text-muted-foreground",
          hasError ? "border-red-500/50" : "border-input"
        )}
      >
        <span className="truncate">{selected ? selected.business_name : "Search for a client..."}</span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {selected && (
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            />
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          <div className="flex items-center border-b border-border px-3 py-2 gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Type to search..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {search && (
              <X className="h-3.5 w-3.5 text-muted-foreground cursor-pointer" onClick={() => setSearch("")} />
            )}
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => handleSelect("")}
              className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/20 italic"
            >
              -- No client --
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground text-center">No clients found</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.client_id}
                  type="button"
                  onClick={() => handleSelect(String(c.client_id))}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-accent/20 transition-colors flex items-center justify-between gap-2",
                    String(c.client_id) === value ? "bg-primary/20 text-primary font-medium" : "text-foreground"
                  )}
                >
                  <span className="truncate">{c.business_name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ({c.contact_count} {c.contact_count === 1 ? "contact" : "contacts"})
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NewJobPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("id")
  const isEditing = !!editId

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form data
  const [projectName, setProjectName] = useState("")
  const [site, setSite] = useState("")
  const [sitePcode, setSitePcode] = useState("")
  const [status, setStatus] = useState("Contact")
  const [clientId, setClientId] = useState("")
  const [jobContacts, setJobContacts] = useState<JobContactRow[]>([])
  const [jobTypeId, setJobTypeId] = useState("")
  const [jobClassId, setJobClassId] = useState("")
  const [nature, setNature] = useState("")
  const [source, setSource] = useState("")
  const [enquiryDate, setEnquiryDate] = useState(new Date().toISOString().split("T")[0])
  const [quotationValue, setQuotationValue] = useState("")
  const [notes, setNotes] = useState("")

  // Lookup data
  const [clients, setClients] = useState<Client[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [jobClasses, setJobClasses] = useState<JobClass[]>([])
  const [loadingLookups, setLoadingLookups] = useState(true)

  // Load lookup data + existing job if editing
  useEffect(() => {
    const fetches: Promise<unknown>[] = [
      fetch("/api/clients").then(r => r.json()),
      fetch("/api/contacts").then(r => r.json()),
      fetch("/api/jobs/filters").then(r => r.json()),
    ]
    if (isEditing) {
      fetches.push(fetch(`/api/jobs/${editId}`).then(r => r.json()))
    }
    Promise.all(fetches).then(([clientsRes, contactsRes, filtersRes, jobRes]) => {
      const cr = clientsRes as { clients: Client[] }
      const cor = contactsRes as { contacts: Contact[] }
      const fr = filtersRes as { jobTypes: JobType[]; jobClasses: JobClass[] }
      setClients(cr.clients || [])
      setContacts(cor.contacts || [])
      setJobTypes(fr.jobTypes || [])
      setJobClasses(fr.jobClasses || [])

      // Pre-fill form if editing existing job
      if (isEditing && jobRes) {
        const jr = jobRes as { job: Record<string, unknown>; jobContacts?: Array<{ contact_id: number; title: string; jobsheet: boolean | null; invoice: boolean | null }> }
        const j = jr.job
        if (j) {
          setProjectName((j.project_name as string) || "")
          setSite((j.site as string) || "")
          setSitePcode((j.site_pcode as string) || "")
          setStatus((j.status as string) || "Contact")
          setClientId(j.client_id ? String(j.client_id) : "")
          setJobTypeId(j.job_type_id ? String(j.job_type_id) : "")
          setJobClassId(j.job_class_id ? String(j.job_class_id) : "")
          setNature((j.nature as string) || "")
          setSource((j.source as string) || "")
          if (j.enquiry_date) setEnquiryDate((j.enquiry_date as string).split("T")[0])
          setQuotationValue(j.quotation_value ? String(j.quotation_value) : "")
          setNotes((j.notes as string) || "")

          if (jr.jobContacts && jr.jobContacts.length > 0) {
            setJobContacts(jr.jobContacts.map(jc => ({
              key: crypto.randomUUID(),
              contact_id: String(jc.contact_id),
              title: jc.title || "Client Contact",
              jobsheet: jc.jobsheet ?? true,
              invoice: jc.invoice ?? false,
            })))
          }
        }
      }
      setLoadingLookups(false)
    }).catch(() => setLoadingLookups(false))
  }, [editId, isEditing])

  // Filter contacts based on selected client
  const filteredContacts = clientId
    ? contacts.filter(c => c.client_id === parseInt(clientId))
    : contacts

  function addJobContact() {
    setJobContacts(prev => [...prev, {
      key: crypto.randomUUID(),
      contact_id: "",
      title: "Client Contact",
      jobsheet: true,
      invoice: false,
    }])
  }

  function removeJobContact(key: string) {
    setJobContacts(prev => prev.filter(jc => jc.key !== key))
  }

  function updateJobContact(key: string, field: keyof JobContactRow, value: string | boolean) {
    setJobContacts(prev => prev.map(jc =>
      jc.key === key ? { ...jc, [field]: value } : jc
    ))
  }

  // Validation
  const canSave = clientId && projectName.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!clientId) {
      setError("Please select a client")
      return
    }
    if (!projectName.trim()) {
      setError("Please enter a project name")
      return
    }
    
    setSaving(true)
    setError(null)

    const payload = {
      project_name: projectName,
      site,
      site_pcode: sitePcode,
      status,
      client_id: clientId || null,
      contact_id: null,
      job_type_id: jobTypeId || null,
      job_class_id: jobClassId || null,
      nature,
      source,
      enquiry_date: enquiryDate,
      quotation_value: quotationValue || null,
      notes,
      jobContacts: jobContacts
        .filter(jc => jc.contact_id)
        .map(jc => ({
          contact_id: parseInt(jc.contact_id),
          title: jc.title,
          jobsheet: jc.jobsheet,
          invoice: jc.invoice,
        })),
    }

    try {
      const response = isEditing
        ? await fetch(`/api/jobs/${editId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/jobs/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || (isEditing ? "Failed to update job" : "Failed to create job"))
      }

      router.push(`/jobs/${data.job.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">

        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{isEditing ? "Complete Job Details" : "New Job"}</h1>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loadingLookups ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Project Details */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Project Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder="Enter project name"
                    className={cn("h-9", !projectName.trim() && "border-red-500/50")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Site Address</label>
                  <Input
                    value={site}
                    onChange={e => setSite(e.target.value)}
                    placeholder="Site address"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Site Postcode</label>
                  <Input
                    value={sitePcode}
                    onChange={e => setSitePcode(e.target.value)}
                    placeholder="Postcode"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Enquiry Date</label>
                  <Input
                    type="date"
                    value={enquiryDate}
                    onChange={e => setEnquiryDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Client & Contacts */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Client & Contacts</h2>

              {/* Client selector */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Client <span className="text-red-500">*</span> <span className="text-muted-foreground/60">({clients.length} available)</span>
                </label>
                <ClientCombobox
                  clients={clients}
                  value={clientId}
                  onChange={setClientId}
                  hasError={!clientId}
                />
              </div>

              {/* Multi-contact section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Contacts {clientId
                      ? <span className="text-muted-foreground/60">({filteredContacts.length} available)</span>
                      : <span className="text-muted-foreground/40 italic">— select a client first</span>
                    }
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addJobContact}
                    disabled={!clientId}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Contact
                  </Button>
                </div>

                {jobContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No contacts added.{clientId ? " Click 'Add Contact' to associate contacts with this job." : ""}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {jobContacts.map(jc => (
                      <div key={jc.key} className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
                        {/* Contact picker */}
                        <div className="flex-1 min-w-0">
                          <Select
                            value={jc.contact_id || "none"}
                            onValueChange={v => updateJobContact(jc.key, "contact_id", v === "none" ? "" : v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select contact" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-- Select contact --</SelectItem>
                              {filteredContacts.map(c => (
                                <SelectItem key={c.contact_id} value={String(c.contact_id)}>
                                  {`${c.fname || ""} ${c.sname || ""}`.trim() || "Unnamed"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Title / role */}
                        <Input
                          value={jc.title}
                          onChange={e => updateJobContact(jc.key, "title", e.target.value)}
                          placeholder="Title"
                          className="h-8 w-36 text-xs"
                        />

                        {/* Jobsheet toggle */}
                        <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            checked={jc.jobsheet}
                            onChange={e => updateJobContact(jc.key, "jobsheet", e.target.checked)}
                            className="rounded border-border"
                          />
                          Sheet
                        </label>

                        {/* Invoice toggle */}
                        <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            checked={jc.invoice}
                            onChange={e => updateJobContact(jc.key, "invoice", e.target.checked)}
                            className="rounded border-border"
                          />
                          Invoice
                        </label>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeJobContact(jc.key)}
                          className="rounded p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Classification */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Classification</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Job Type <span className="text-muted-foreground/60">({jobTypes.length} available)</span>
                  </label>
                  <Select value={jobTypeId || "none"} onValueChange={v => setJobTypeId(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- No type --</SelectItem>
                      {jobTypes.map(t => (
                        <SelectItem key={t.job_type_id} value={String(t.job_type_id)}>{t.job_type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Job Class <span className="text-muted-foreground/60">({jobClasses.length} available)</span>
                  </label>
                  <Select value={jobClassId || "none"} onValueChange={v => setJobClassId(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- No class --</SelectItem>
                      {jobClasses.map(c => (
                        <SelectItem key={c.job_class_id} value={String(c.job_class_id)}>{c.job_class}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nature</label>
                  <Input
                    value={nature}
                    onChange={e => setNature(e.target.value)}
                    placeholder="e.g. Installation, Maintenance"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Source</label>
                  <Input
                    value={source}
                    onChange={e => setSource(e.target.value)}
                    placeholder="e.g. Website, Referral"
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Financial */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Financial</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Quotation Value (GBP)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quotationValue}
                    onChange={e => setQuotationValue(e.target.value)}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Notes</h2>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add any notes about this job..."
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pb-8">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !canSave}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditing ? "Save Changes" : "Create Job"}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
