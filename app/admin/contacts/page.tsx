"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, ChevronsUpDown, Check, Search, X, Plus, Pencil, Ban, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Contact {
  contact_id: number
  fname: string | null
  sname: string | null
  client_id: number
  title: string | null
  tel: string | null
  mobile: string | null
  email: string | null
  active: string | null
}

interface ClientOption {
  client_id: number
  business_name: string
  active: string | null
}

type StatusFilter = "active" | "inactive" | "all"

const PAGE_SIZES = [10, 25, 50, 100]

const BLANK_FORM = {
  title: "", fname: "", sname: "", email: "", tel: "", mobile: "", client_id: "",
}

function isActive(c: Contact) {
  return (c.active ?? "").toLowerCase() !== "n"
}

function fullName(c: Contact) {
  return [c.title, c.fname, c.sname].filter(Boolean).join(" ").trim()
}

// Searchable client picker — a plain <select> over 1,300+ clients is unusable.
function ClientCombobox({
  clients, value, onChange, placeholder = "Select client…",
}: {
  clients: ClientOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = clients.find(c => String(c.client_id) === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.business_name : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(val, sq) => {
            const c = clients.find(x => String(x.client_id) === val)
            const name = c?.business_name ?? ""
            return name.toLowerCase().includes(sq.toLowerCase()) ? 1 : 0
          }}
        >
          <CommandInput placeholder="Search clients…" />
          <CommandList>
            <CommandEmpty>No client found.</CommandEmpty>
            <CommandGroup>
              {clients.map(c => (
                <CommandItem
                  key={c.client_id}
                  value={String(c.client_id)}
                  onSelect={val => { onChange(val); setOpen(false) }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === String(c.client_id) ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{c.business_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function ManageContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")
  // "scoped" (default) shows only contacts linked to a Strettons (company-6)
  // client; "all" reveals the ~5k contacts imported for other companies whose
  // client was never brought across (they render with an unresolved #id).
  const [scopeFilter, setScopeFilter] = useState<"scoped" | "all">("scoped")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null)
  const [rowBusy, setRowBusy] = useState<number | null>(null)

  const clientName = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of clients) m.set(c.client_id, c.business_name)
    return m
  }, [clients])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [contactsRes, clientsRes] = await Promise.all([
        fetch("/api/contacts?status=all").then(r => r.json()),
        fetch("/api/clients?status=all").then(r => r.json()),
      ])
      if (contactsRes.error) throw new Error(contactsRes.error)
      if (clientsRes.error) throw new Error(clientsRes.error)
      setContacts(contactsRes.contacts || [])
      setClients(
        (clientsRes.clients || []).map((c: ClientOption) => ({
          client_id: c.client_id,
          business_name: c.business_name,
          active: c.active,
        }))
      )
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load contacts")
      setContacts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, statusFilter, scopeFilter, pageSize])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter(c => {
      if (scopeFilter === "scoped" && !clientName.has(c.client_id)) return false
      if (statusFilter === "active" && !isActive(c)) return false
      if (statusFilter === "inactive" && isActive(c)) return false
      if (!q) return true
      return (
        fullName(c).toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (clientName.get(c.client_id) ?? "").toLowerCase().includes(q)
      )
    })
  }, [contacts, search, statusFilter, scopeFilter, clientName])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  // Keep the page in range when a mutation (deactivate/reactivate/filter) shrinks the result set
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  // Only active clients are offered for assignment, but keep an already-linked
  // (possibly inactive) client visible when editing an existing contact.
  const pickerClients = useMemo(() => {
    const active = clients.filter(c => (c.active ?? "").toLowerCase() !== "n")
    if (form.client_id && !active.some(c => String(c.client_id) === form.client_id)) {
      const current = clients.find(c => String(c.client_id) === form.client_id)
      if (current) return [current, ...active]
    }
    return active
  }, [clients, form.client_id])

  function openAdd() {
    setEditing(null)
    setForm(BLANK_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(c: Contact) {
    setEditing(c)
    setForm({
      title: c.title ?? "",
      fname: c.fname ?? "",
      sname: c.sname ?? "",
      email: c.email ?? "",
      tel: c.tel ?? "",
      mobile: c.mobile ?? "",
      client_id: String(c.client_id ?? ""),
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function saveForm() {
    if (!form.client_id) { setFormError("Please select a client"); return }
    if (!form.fname.trim() && !form.sname.trim()) { setFormError("Enter a first name or surname"); return }
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch(
        editing ? `/api/contacts/${editing.contact_id}` : "/api/contacts",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, client_id: parseInt(form.client_id) }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save contact")
      setDialogOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save contact")
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeactivate() {
    const target = pendingDelete
    if (!target) return
    setRowBusy(target.contact_id)
    try {
      const res = await fetch(`/api/contacts/${target.contact_id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to deactivate contact")
      setContacts(cs => cs.map(c => c.contact_id === target.contact_id ? { ...c, active: "n" } : c))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to deactivate contact")
    } finally {
      setRowBusy(null)
      setPendingDelete(null)
    }
  }

  async function reactivate(c: Contact) {
    setRowBusy(c.contact_id)
    try {
      const res = await fetch(`/api/contacts/${c.contact_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: "y" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to reactivate contact")
      setContacts(cs => cs.map(x => x.contact_id === c.contact_id ? { ...x, active: "y" } : x))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to reactivate contact")
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              <Link href="/admin" className="hover:text-foreground">Admin</Link> / Contacts
            </div>
            <h1 className="text-2xl font-bold text-foreground">Manage Contacts</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${total.toLocaleString()} ${statusFilter === "all" ? "" : statusFilter + " "}contact${total === 1 ? "" : "s"}`}
            </p>
          </div>
          <Button onClick={openAdd} className="h-9">
            <Plus className="h-4 w-4 mr-1" /> Add contact
          </Button>
        </div>

        {loadError && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 my-4">
          <form
            onSubmit={e => { e.preventDefault(); setSearch(searchInput) }}
            className="relative flex items-center"
          >
            <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search name, email, client…"
              className="pl-8 pr-8 h-9 w-72 text-sm"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(""); setSearch("") }} className="absolute right-2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </form>

          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>

          <Select value={scopeFilter} onValueChange={v => setScopeFilter(v as "scoped" | "all")}>
            <SelectTrigger className="h-9 w-48 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="scoped">Strettons clients only</SelectItem>
              <SelectItem value="all">All imported contacts</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Name</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Email</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Phone</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Client</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No contacts found</td></tr>
              ) : (
                pageRows.map((c, i) => {
                  const active = isActive(c)
                  const busy = rowBusy === c.contact_id
                  const phone = c.mobile || c.tel
                  return (
                    <tr
                      key={c.contact_id}
                      className={cn(
                        "border-b border-border last:border-0",
                        i % 2 === 0 ? "bg-background" : "bg-muted/20",
                        !active && "opacity-60"
                      )}
                    >
                      <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                        {fullName(c) || <span className="italic text-muted-foreground">Unnamed</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[240px] truncate" title={c.email ?? ""}>
                        {c.email ? <a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a> : ""}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{phone}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[260px] truncate" title={clientName.get(c.client_id) ?? ""}>
                        {clientName.get(c.client_id) ?? <span className="italic text-muted-foreground/70">#{c.client_id}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-xs font-medium leading-none",
                          active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                        )}>
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          {active ? (
                            <Button
                              variant="ghost" size="sm" disabled={busy}
                              className="h-8 px-2 text-destructive hover:text-destructive"
                              onClick={() => setPendingDelete(c)}
                            >
                              <Ban className="h-3.5 w-3.5 mr-1" /> Deactivate
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" disabled={busy} className="h-8 px-2" onClick={() => reactivate(c)}>
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">|</span>
              <span className="text-xs text-muted-foreground">Rows:</span>
              <div className="flex items-center gap-1">
                {PAGE_SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => setPageSize(s)}
                    className={cn(
                      "h-6 min-w-[28px] px-1.5 rounded text-xs font-medium border transition-colors",
                      pageSize === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 w-7 p-0">
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs px-2 text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 w-7 p-0">
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) setDialogOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit contact" : "Add contact"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this contact's details." : "Create a new contact record."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label>Client *</Label>
              <ClientCombobox
                clients={pickerClients}
                value={form.client_id}
                onChange={id => setForm(f => ({ ...f, client_id: id }))}
              />
            </div>
            <div className="grid grid-cols-[80px_1fr_1fr] gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fname">First name</Label>
                <Input id="fname" value={form.fname}
                  onChange={e => setForm(f => ({ ...f, fname: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sname">Surname</Label>
                <Input id="sname" value={form.sname}
                  onChange={e => setForm(f => ({ ...f, sname: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tel">Telephone</Label>
                <Input id="tel" value={form.tel}
                  onChange={e => setForm(f => ({ ...f, tel: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" value={form.mobile}
                  onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
              </div>
            </div>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveForm} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={o => { if (!o) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? fullName(pendingDelete) || "This contact" : ""} will be marked inactive and hidden
              from the active list. Existing jobs are not affected, and you can reactivate the contact at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
