"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Homepage" },
  { href: "/jobs", label: "Jobs" },
  { href: "/reports", label: "Reports" },
  { href: "/admin", label: "Admin" },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-semibold text-foreground">
              Project Manager
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = 
                  item.href === "/" 
                    ? pathname === "/" 
                    : pathname.startsWith(item.href)
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}
