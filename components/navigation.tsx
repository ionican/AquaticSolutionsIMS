"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/reports", label: "Reports" },
  { href: "/admin", label: "Admin" },
]

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState("")

  // Pick the single best-matching nav item (longest matching href wins,
  // so /admin/clients beats /admin when you're on the Clients page).
  const activeHref = navItems
    .filter((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    // For now the search box jumps to the Jobs list; wiring the term through
    // to the jobs filters comes in a later step.
    router.push("/jobs")
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white">
      <div className="mx-auto max-w-[1320px] px-6">
        <nav className="flex h-[62px] items-center gap-6">
          {/* Brand */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid size-[34px] place-items-center rounded-[9px] bg-gradient-to-br from-primary to-[#0d93a1] text-white shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M2 11c1.6 0 2.6-1.6 5-1.6S14 11 16 11s2.6-1.6 5-1.6" />
                <path d="M2 16c1.6 0 2.6-1.6 5-1.6S14 16 16 16s2.6-1.6 5-1.6" />
              </svg>
            </span>
            <span className="text-[0.92rem] font-bold italic leading-none tracking-tight">
              Aquatic <span className="text-[#0d93a1]">Solutions</span>
              <small className="mt-0.5 block text-[0.6rem] font-semibold not-italic tracking-[0.18em] text-muted-foreground/70">
                UK · IMS
              </small>
            </span>
          </Link>

          {/* Tabs */}
          <div className="flex h-full flex-1 items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = item.href === activeHref
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-full items-center gap-1.5 border-b-[2.5px] px-3 text-[0.875rem] font-medium transition-colors -mb-px",
                    isActive
                      ? "border-primary font-semibold text-[#0d93a1]"
                      : "border-transparent text-[#41525e] hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative hidden w-[300px] shrink-0 md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground/70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs, clients, invoices…"
              className="w-full rounded-[9px] border border-transparent bg-[#f3f5f6] py-2 pl-8 pr-3 text-[0.85rem] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:bg-white"
            />
          </form>

          {/* User pill */}
          <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-border py-1 pl-3 pr-1">
            <span className="text-[0.65rem] font-bold tracking-[0.1em] text-muted-foreground">MANAGER</span>
            <span className="grid size-[30px] place-items-center rounded-full bg-primary text-[0.72rem] font-bold text-white">
              TS
            </span>
          </div>
        </nav>
      </div>
    </header>
  )
}
