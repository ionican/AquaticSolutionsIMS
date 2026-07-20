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
import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Search, X, Plus, Pencil, Ban, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Client {
  client_id: number
  business_name: string
  address1: string | null
  address2: string | null
  town: string | null
  county: string | null
  pcode: string | null
  web_site: string | null
  active: string | null
  contact_count: number
}

type StatusFilter = "active" | "inactive" | "all"

const PAGE_SIZES = [10, 25, 50, 100]

const BLANK_FORM = {
  business_name: "", address1: "", address2: "", town: "", county: "", pcode: "", web_site: "",
}

function isActive(c: Client) {
  return (c.active ?? "").toLowerCase() !== "n"
}

export default function ManageClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Add / edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Deactivate confirm
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null)
  const [rowBusy, setRowBusy] = useState<number | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/clients?status=all")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load clients")
      setClients(data.clients || [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load clients")
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])
  useEffect(() => { setPage(1) }, [search, statusFilter, pageSize])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter(c => {
      if (statusFilter === "active" && !isActive(c)) return false
      if (statusFilter === "inactive" && isActive(c)) return false
      if (!q) return true
      return (
        (c.business_name ?? "").toLowerCase().includes(q) ||
        (c.town ?? "").toLowerCase().includes(q) ||
        (c.pcode ?? "").toLowerCase().includes(q)
      )
    })
  }, [clients, search, statusFilter])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  // Keep the page in range when a mutation (deactivate/reactivate/filter) shrinks the result set
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  function openAdd() {
    setEditing(null)
    setForm(BLANK_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({
      business_name: c.business_name ?? "",
      address1: c.address1 ?? "",
      address2: c.address2 ?? "",
      town: c.town ?? "",
      county: c.county ?? "",
      pcode: c.pcode ?? "",
      web_site: c.web_site ?? "",
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function saveForm() {
    if (!form.business_name.trim()) {
      setFormError("Client name is required")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch(
        editing ? `/api/clients/${editing.client_id}` : "/api/clients",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save client")
      setDialogOpen(false)
      await fetchClients()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save client")
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeactivate() {
    const target = pendingDelete
    if (!target) return
    setRowBusy(target.client_id)
    try {
      const res = await fetch(`/api/clients/${target.client_id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to deactivate client")
      setClients(cs => cs.map(c => c.client_id === target.client_id ? { ...c, active: "n" } : c))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to deactivate client")
    } finally {
      setRowBusy(null)
      setPendingDelete(null)
    }
  }

  async function reactivate(c: Client) {
    setRowBusy(c.client_id)
    try {
      const res = await fetch(`/api/clients/${c.client_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: "y" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to reactivate client")
      setClients(cs => cs.map(x => x.client_id === c.client_id ? { ...x, active: "y" } : x))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to reactivate client")
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
              <Link href="/admin" className="hover:text-foreground">Admin</Link> / Clients
            </div>
            <h1 className="text-2xl font-bold text-foreground">Manage Clients</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${total.toLocaleString()} ${statusFilter === "all" ? "" : statusFilter + " "}client${total === 1 ? "" : "s"}`}
            </p>
          </div>
          <Button onClick={openAdd} className="h-9">
            <Plus className="h-4 w-4 mr-1" /> Add client
          </Button>
        </div>

        {loadError && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 my-4">
          <form
            onSubmit={e => { e.preventDefault(); setSearch(searchInput) }}
            className="relative flex items-center"
          >
            <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search name, town, postcode…"
              className="pl-8 pr-8 h-9 w-72 text-sm"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSearch("") }}
                className="absolute right-2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </form>

          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Business name</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Town</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Postcode</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Contacts</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No clients found</td></tr>
              ) : (
                pageRows.map((c, i) => {
                  const active = isActive(c)
                  const busy = rowBusy === c.client_id
                  return (
                    <tr
                      key={c.client_id}
                      className={cn(
                        "border-b border-border last:border-0",
                        i % 2 === 0 ? "bg-background" : "bg-muted/20",
                        !active && "opacity-60"
                      )}
                    >
                      <td className="px-3 py-2 font-medium text-foreground max-w-[320px] truncate" title={c.business_name}>
                        {c.business_name || <span className="italic text-muted-foreground">Unnamed</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{c.town}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{c.pcode}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{c.contact_count}</td>
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
                            <Button
                              variant="ghost" size="sm" disabled={busy}
                              className="h-8 px-2"
                              onClick={() => reactivate(c)}
                            >
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

        {/* Pagination */}
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

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) setDialogOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit client" : "Add client"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this client's details." : "Create a new client record."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="business_name">Business name *</Label>
              <Input id="business_name" value={form.business_name}
                onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="address1">Address line 1</Label>
              <Input id="address1" value={form.address1}
                onChange={e => setForm(f => ({ ...f, address1: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="address2">Address line 2</Label>
              <Input id="address2" value={form.address2}
                onChange={e => setForm(f => ({ ...f, address2: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="town">Town</Label>
                <Input id="town" value={form.town}
                  onChange={e => setForm(f => ({ ...f, town: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="county">County</Label>
                <Input id="county" value={form.county}
                  onChange={e => setForm(f => ({ ...f, county: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pcode">Postcode</Label>
                <Input id="pcode" value={form.pcode}
                  onChange={e => setForm(f => ({ ...f, pcode: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="web_site">Website</Label>
                <Input id="web_site" value={form.web_site}
                  onChange={e => setForm(f => ({ ...f, web_site: e.target.value }))} />
              </div>
            </div>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveForm} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirm */}
      <AlertDialog open={!!pendingDelete} onOpenChange={o => { if (!o) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this client?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.business_name} will be marked inactive and hidden from the active list.
              Existing jobs are not affected, and you can reactivate the client at any time.
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
