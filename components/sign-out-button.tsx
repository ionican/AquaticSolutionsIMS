"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut} className={className}>
      <LogOut className="size-4" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  )
}
