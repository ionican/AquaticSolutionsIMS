"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
const CREATE_NEW_CONTACT_VALUE = "__create_new_contact__"
const ROLE_PRESETS = [
  { value: "invoice", label: "Invoice Contact", title: "Invoice Contact", invoice: true, jobsheet: false, prenotification: false },
  { value: "jobsheet", label: "Jobsheet Contact", title: "Jobsheet Contact", invoice: false, jobsheet: true, prenotification: false },
  { value: "prenotification", label: "Pre-notification Contact", title: "Pre-notification Contact", invoice: false, jobsheet: false, prenotification: true },
  { value: "custom", label: "Custom category...", title: "", invoice: false, jobsheet: false, prenotification: false },
] as const

type ContactTarget =
  | { type: "main" }
  | { type: "additional"; localId: string }

interface Client {
  client_id: number
  business_name: string
  contact_count: number
}

interface Contact {
  contact_id: number
  fname: string | null
  sname: string | null
  client_id: number
  title?: string | null
  tel?: string | null
  mobile?: string | null
  email?: string | null
}

interface AdditionalJobContact {
  localId: string
  contact_id: string
  role: string
  title: string
  invoice: boolean
  jobsheet: boolean
  prenotification: boolean
}

interface ExistingJobContact {
  id: number
  contact_id: number | null
  title: string | null
  invoice: boolean | null
  jobsheet: boolean | null
  prenotification: boolean | null
}

interface JobType {
  job_type_id: number
  job_type: string
}

interface JobClass {
  job_class_id: number
  job_class: string
}

function contactDisplayName(contact: Contact) {
  return [contact.title, contact.fname, contact.sname].filter(Boolean).join(" ") || "Unnamed"
}

function createBlankAdditionalContact(): AdditionalJobContact {
  return {
    localId: crypto.randomUUID(),
    contact_id: "",
    role: "invoice",
    title: "Invoice Contact",
    invoice: true,
    jobsheet: false,
    prenotification: false,
  }
}

function applyRolePreset(role: string): Pick<AdditionalJobContact, "role" | "title" | "invoice" | "jobsheet" | "prenotification"> {
  const preset = ROLE_PRESETS.find(item => item.value === role) || ROLE_PRESETS[0]

  return {
    role: preset.value,
    title: preset.title,
    invoice: preset.invoice,
    jobsheet: preset.jobsheet,
    prenotification: preset.prenotification,
  }
}

function inferContactRole(jobContact: ExistingJobContact) {
  if (jobContact.invoice) return "invoice"
  if (jobContact.jobsheet) return "jobsheet"
  if (jobContact.prenotification) return "prenotification"
  return "custom"
}

// Searchable combobox component for clients
function ClientCombobox({
  clients,
  value,
  onChange,
  onCreateClient,
  creatingClient,
  hasError,
}: {
  clients: Client[]
  value: string
  onChange: (val: string) => void
  onCreateClient: (businessName: string) => void
  creatingClient?: boolean
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
  const trimmedSearch = search.trim()
  const hasExactMatch = clients.some(c => c.business_name?.toLowerCase() === trimmedSearch.toLowerCase())

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
            {trimmedSearch && !hasExactMatch && (
              <button
                type="button"
                onClick={() => {
                  onCreateClient(trimmedSearch)
                  setOpen(false)
                  setSearch("")
                }}
                disabled={creatingClient}
                className="w-full border-t border-border px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent/20 disabled:opacity-50"
              >
                + Create client "{trimmedSearch}"
              </button>
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
  const [creatingClient, setCreatingClient] = useState(false)

  // Form data
  const [projectName, setProjectName] = useState("")
  const [site, setSite] = useState("")
  const [sitePcode, setSitePcode] = useState("")
  const [status, setStatus] = useState("Contact")
  const [clientId, setClientId] = useState("")
  const [contactId, setContactId] = useState("")
  const [jobTypeId, setJobTypeId] = useState("")
  const [jobClassId, setJobClassId] = useState("")
  const [nature, setNature] = useState("")
  const [source, setSource] = useState("")
  const [enquiryDate, setEnquiryDate] = useState(new Date().toISOString().split("T")[0])
  const [quotationValue, setQuotationValue] = useState("")
  const [notes, setNotes] = useState("")
  const [additionalContacts, setAdditionalContacts] = useState<AdditionalJobContact[]>([])
  const [newContactTarget, setNewContactTarget] = useState<ContactTarget | null>(null)
  const [creatingContact, setCreatingContact] = useState(false)
  const [newContactError, setNewContactError] = useState<string | null>(null)
  const [newContactForm, setNewContactForm] = useState({
    title: "",
    fname: "",
    sname: "",
    email: "",
    tel: "",
    mobile: "",
  })

  // Lookup data
  const [clients, setClients] = useState<Client[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
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
        const jr = jobRes as { job: Record<string, unknown> }
        const j = jr.job
        if (j) {
          setProjectName((j.project_name as string) || "")
          setSite((j.site as string) || "")
          setSitePcode((j.site_pcode as string) || "")
          setStatus((j.status as string) || "Contact")
          setClientId(j.client_id ? String(j.client_id) : "")
          setContactId(j.contact_id ? String(j.contact_id) : "")
          setJobTypeId(j.job_type_id ? String(j.job_type_id) : "")
          setJobClassId(j.job_class_id ? String(j.job_class_id) : "")
          setNature((j.nature as string) || "")
          setSource((j.source as string) || "")
          if (j.enquiry_date) setEnquiryDate((j.enquiry_date as string).split("T")[0])
          setQuotationValue(j.quotation_value ? String(j.quotation_value) : "")
          setNotes((j.notes as string) || "")
          const existingJobContacts = (j.jobContacts as ExistingJobContact[] | undefined) || []
          setAdditionalContacts(existingJobContacts
            .filter(jobContact => jobContact.contact_id)
            .map(jobContact => {
              const role = inferContactRole(jobContact)

              return {
                localId: String(jobContact.id),
                contact_id: String(jobContact.contact_id),
                role,
                title: jobContact.title || "",
                invoice: !!jobContact.invoice,
                jobsheet: !!jobContact.jobsheet,
                prenotification: !!jobContact.prenotification,
              }
            }))
        }
      }
      setLoadingLookups(false)
    }).catch(() => setLoadingLookups(false))
  }, [editId, isEditing])

  // Filter contacts when client changes
  useEffect(() => {
    if (clientId) {
      setFilteredContacts(contacts.filter(c => c.client_id === parseInt(clientId)))
    } else {
      setFilteredContacts(contacts)
    }
  }, [clientId, contacts])

  const handleClientChange = (nextClientId: string) => {
    setClientId(nextClientId)
    setContactId("")
    setAdditionalContacts([])
  }

  const handleCreateClient = async (businessName: string) => {
    const name = businessName.trim()
    if (!name) return

    setCreatingClient(true)
    setError(null)

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_name: name }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create client")
      }

      const client = data.client as Client
      setClients(current => [...current, client].sort((a, b) => a.business_name.localeCompare(b.business_name)))
      handleClientChange(String(client.client_id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client")
    } finally {
      setCreatingClient(false)
    }
  }

  const addAdditionalContact = () => {
    setAdditionalContacts(current => [...current, createBlankAdditionalContact()])
  }

  const updateAdditionalContact = (
    localId: string,
    updates: Partial<Omit<AdditionalJobContact, "localId">>
  ) => {
    setAdditionalContacts(current => current.map(jobContact =>
      jobContact.localId === localId ? { ...jobContact, ...updates } : jobContact
    ))
  }

  const removeAdditionalContact = (localId: string) => {
    setAdditionalContacts(current => current.filter(jobContact => jobContact.localId !== localId))
  }

  const openNewContactDialog = (target: ContactTarget) => {
    if (!clientId) {
      setError("Please select a client before adding a contact")
      return
    }

    setNewContactTarget(target)
    setNewContactError(null)
    setNewContactForm({
      title: "",
      fname: "",
      sname: "",
      email: "",
      tel: "",
      mobile: "",
    })
  }

  const handleContactSelect = (value: string, target: ContactTarget) => {
    if (value === CREATE_NEW_CONTACT_VALUE) {
      openNewContactDialog(target)
      return
    }

    if (target.type === "main") {
      setContactId(value === "none" ? "" : value)
      return
    }

    updateAdditionalContact(target.localId, {
      contact_id: value === "none" ? "" : value,
    })
  }

  const handleRoleChange = (localId: string, role: string) => {
    updateAdditionalContact(localId, applyRolePreset(role))
  }

  const handleCreateContact = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!newContactTarget) return
    if (!clientId) {
      setNewContactError("Select a client before creating a contact")
      return
    }
    if (!newContactForm.fname.trim() && !newContactForm.sname.trim()) {
      setNewContactError("Enter a first name or surname")
      return
    }

    setCreatingContact(true)
    setNewContactError(null)

    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          title: newContactForm.title,
          fname: newContactForm.fname,
          sname: newContactForm.sname,
          email: newContactForm.email,
          tel: newContactForm.tel,
          mobile: newContactForm.mobile,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create contact")
      }

      const contact = data.contact as Contact
      setContacts(current => [...current, contact].sort((a, b) => contactDisplayName(a).localeCompare(contactDisplayName(b))))

      if (newContactTarget.type === "main") {
        setContactId(String(contact.contact_id))
      } else {
        updateAdditionalContact(newContactTarget.localId, { contact_id: String(contact.contact_id) })
      }

      setNewContactTarget(null)
    } catch (err) {
      setNewContactError(err instanceof Error ? err.message : "Failed to create contact")
    } finally {
      setCreatingContact(false)
    }
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
      contact_id: contactId || null,
      job_type_id: jobTypeId || null,
      job_class_id: jobClassId || null,
      nature,
      source,
      enquiry_date: enquiryDate,
      quotation_value: quotationValue || null,
      notes,
      jobContacts: additionalContacts
        .filter(jobContact => jobContact.contact_id)
        .map(jobContact => ({
          contact_id: jobContact.contact_id,
          title: jobContact.title || null,
          invoice: jobContact.invoice,
          jobsheet: jobContact.jobsheet,
          prenotification: jobContact.prenotification,
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

            {/* Client & Contact */}
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client & Contact</h2>
                <Button type="button" size="sm" variant="outline" onClick={addAdditionalContact} disabled={!clientId}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Contact
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Client <span className="text-red-500">*</span> <span className="text-muted-foreground/60">({clients.length} available)</span>
                  </label>
                  <ClientCombobox
                    clients={clients}
                    value={clientId}
                    onChange={handleClientChange}
                    onCreateClient={handleCreateClient}
                    creatingClient={creatingClient}
                    hasError={!clientId}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Contact {clientId
                      ? <span className="text-muted-foreground/60">({filteredContacts.length} available)</span>
                      : <span className="text-muted-foreground/40 italic">— select a client first</span>
                    }
                  </label>
                  <Select
                    value={contactId || "none"}
                    onValueChange={value => handleContactSelect(value, { type: "main" })}
                    disabled={!clientId}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={clientId ? "Select contact" : "Select a client first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- No contact --</SelectItem>
                      <SelectItem value={CREATE_NEW_CONTACT_VALUE}>+ Create new contact...</SelectItem>
                      {filteredContacts.map(c => (
                        <SelectItem key={c.contact_id} value={String(c.contact_id)}>
                          {contactDisplayName(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {additionalContacts.length > 0 && (
                <div className="mt-5 space-y-3 border-t border-border pt-4">
                  <div>
                    <h3 className="text-xs font-medium text-foreground">Additional contacts</h3>
                  </div>
                  {additionalContacts.map((jobContact, index) => (
                    <div key={jobContact.localId} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,220px)_auto]">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Contact {index + 2}
                        </label>
                        <Select
                          value={jobContact.contact_id || "none"}
                          onValueChange={value => handleContactSelect(value, {
                            type: "additional",
                            localId: jobContact.localId,
                          })}
                          disabled={!clientId}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={clientId ? "Select contact" : "Select a client first"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Select contact --</SelectItem>
                            <SelectItem value={CREATE_NEW_CONTACT_VALUE}>+ Create new contact...</SelectItem>
                            {filteredContacts.map(contact => (
                              <SelectItem key={contact.contact_id} value={String(contact.contact_id)}>
                                {contactDisplayName(contact)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Category
                        </label>
                        <Select value={jobContact.role} onValueChange={value => handleRoleChange(jobContact.localId, value)}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_PRESETS.map(role => (
                              <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => removeAdditionalContact(jobContact.localId)}
                          aria-label="Remove contact"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {jobContact.role === "custom" && (
                        <div className="sm:col-span-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                              Custom category
                            </label>
                            <Input
                              value={jobContact.title}
                              onChange={event => updateAdditionalContact(jobContact.localId, { title: event.target.value })}
                              placeholder="e.g. Site Contact"
                              className="h-9"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3 pt-6 sm:min-w-[260px]">
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={jobContact.jobsheet}
                              onCheckedChange={checked => updateAdditionalContact(jobContact.localId, { jobsheet: checked === true })}
                            />
                            Jobsheet
                          </label>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={jobContact.invoice}
                              onCheckedChange={checked => updateAdditionalContact(jobContact.localId, { invoice: checked === true })}
                            />
                            Invoice
                          </label>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={jobContact.prenotification}
                              onCheckedChange={checked => updateAdditionalContact(jobContact.localId, { prenotification: checked === true })}
                            />
                            Pre-notify
                          </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
      <Dialog open={!!newContactTarget} onOpenChange={open => !open && setNewContactTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create contact</DialogTitle>
            <DialogDescription>
              Add a contact for the selected client, then use it on this job.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateContact} className="space-y-4">
            {newContactError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {newContactError}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Title</label>
                <Input
                  value={newContactForm.title}
                  onChange={event => setNewContactForm(current => ({ ...current, title: event.target.value }))}
                  placeholder="Mr"
                  className="h-9"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">First name</label>
                <Input
                  value={newContactForm.fname}
                  onChange={event => setNewContactForm(current => ({ ...current, fname: event.target.value }))}
                  placeholder="First name"
                  className="h-9"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Surname</label>
                <Input
                  value={newContactForm.sname}
                  onChange={event => setNewContactForm(current => ({ ...current, sname: event.target.value }))}
                  placeholder="Surname"
                  className="h-9"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
              <Input
                type="email"
                value={newContactForm.email}
                onChange={event => setNewContactForm(current => ({ ...current, email: event.target.value }))}
                placeholder="name@example.com"
                className="h-9"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Telephone</label>
                <Input
                  value={newContactForm.tel}
                  onChange={event => setNewContactForm(current => ({ ...current, tel: event.target.value }))}
                  placeholder="Telephone"
                  className="h-9"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mobile</label>
                <Input
                  value={newContactForm.mobile}
                  onChange={event => setNewContactForm(current => ({ ...current, mobile: event.target.value }))}
                  placeholder="Mobile"
                  className="h-9"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewContactTarget(null)}
                disabled={creatingContact}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingContact}>
                {creatingContact ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Contact"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
