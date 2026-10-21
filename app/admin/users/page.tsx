"use client"

import { Navigation } from "@/components/navigation"
import { useRole } from "@/components/role-provider"
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
import { Search, X, Plus, Trash2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { ROLES, ROLE_LABELS, parseRole, roleLabel, type Role } from "@/lib/roles"
import Link from "next/link"

interface ManagedUser {
  id: string
  email: string | null
  created_at: string | null
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  invited_at: string | null
  role: Role | null
}

function formatDate(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

// Confirmed = they have set a password and signed in at least once. Invited =
// the invitation email has gone out but has not been accepted yet.
function statusOf(u: ManagedUser) {
  if (u.email_confirmed_at) return "Active"
  if (u.invited_at) return "Invited"
  return "Pending"
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  // Used only to disable the controls on your own row; the API guards are the
  // actual protection.
  const { userId: currentUserId } = useRole()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [newRole, setNewRole] = useState<Role | "">("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<ManagedUser | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/users")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load users")
      setUsers(data.users || [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load users")
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(u => (u.email ?? "").toLowerCase().includes(q))
  }, [users, search])

  const total = filtered.length

  function openAdd() {
    setEmail("")
    setNewRole("")
    setFormError(null)
    setDialogOpen(true)
  }

  async function inviteUser() {
    const trimmed = email.trim()
    if (!trimmed) { setFormError("Enter an email address"); return }
    if (!newRole) { setFormError("Choose a role"); return }
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to invite user")
      setDialogOpen(false)
      setNotice(`Invitation sent to ${trimmed}.`)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to invite user")
    } finally {
      setSaving(false)
    }
  }

  async function changeRole(target: ManagedUser, role: Role) {
    if (role === target.role) return
    setRowBusy(target.id)
    setNotice(null)
    setLoadError(null)
    try {
      const res = await fetch(`/api/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to change role")
      setNotice(`${target.email || "The account"} is now ${ROLE_LABELS[role]}. It applies from their next page load.`)
      await load()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to change role")
    } finally {
      setRowBusy(null)
    }
  }

  async function confirmDelete() {
    const target = pendingDelete
    if (!target) return
    setRowBusy(target.id)
    setNotice(null)
    try {
      const res = await fetch(`/api/users/${target.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete user")
      setNotice(`${target.email || "The account"} has been deleted.`)
      await load()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to delete user")
    } finally {
      setRowBusy(null)
      setPendingDelete(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              <Link href="/admin" className="hover:text-foreground">Admin</Link> / Users
            </div>
            <h1 className="text-2xl font-bold text-foreground">Manage Users</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${total.toLocaleString()} user${total === 1 ? "" : "s"}`}
            </p>
          </div>
          <Button onClick={openAdd} className="h-9">
            <Plus className="h-4 w-4 mr-1" /> Add user
          </Button>
        </div>

        {loadError && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
        )}

        {notice && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
            <Check className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{notice}</span>
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
              placeholder="Search email…"
              className="pl-8 pr-8 h-9 w-72 text-sm"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(""); setSearch("") }} className="absolute right-2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </form>
        </div>

        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Email</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Role</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Created</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Last sign-in</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No users found</td></tr>
              ) : (
                filtered.map((u, i) => {
                  const status = statusOf(u)
                  const busy = rowBusy === u.id
                  const isSelf = currentUserId === u.id
                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        "border-b border-border last:border-0",
                        i % 2 === 0 ? "bg-background" : "bg-muted/20"
                      )}
                    >
                      <td className="px-3 py-2 font-medium text-foreground max-w-[320px] truncate" title={u.email ?? ""}>
                        {u.email || <span className="italic text-muted-foreground">No email</span>}
                        {isSelf && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
                      </td>
                      <td className="px-3 py-2">
                        {isSelf ? (
                          <span className="text-foreground" title="You cannot change your own role">{roleLabel(u.role)}</span>
                        ) : (
                          <Select
                            value={u.role ?? ""}
                            disabled={busy}
                            onValueChange={v => { const role = parseRole(v); if (role) changeRole(u, role) }}
                          >
                            <SelectTrigger className="h-8 w-44 text-sm" aria-label={`Role for ${u.email ?? "user"}`}>
                              <SelectValue placeholder="No role" />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map(r => (
                                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(u.created_at)}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {u.last_sign_in_at ? formatDate(u.last_sign_in_at) : "Never"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-xs font-medium leading-none",
                          status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                        )}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="sm" disabled={busy || isSelf}
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            title={isSelf ? "You cannot delete your own account" : undefined}
                            onClick={() => setPendingDelete(u)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) setDialogOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              An invitation email will be sent to this address. The user sets their own
              password from the link, then has the access their role allows.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email" type="email" value={email} autoComplete="off"
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="role">Role *</Label>
              <Select value={newRole} onValueChange={v => setNewRole(parseRole(v) ?? "")}>
                <SelectTrigger id="role" className="w-full">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={inviteUser} disabled={saving}>
              {saving ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={o => { if (!o) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the account for {pendingDelete?.email || "this user"} and
              their access. This cannot be undone.
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
