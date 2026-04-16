"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"

export function DeploymentBanner() {
  const [newVersion, setNewVersion] = useState(false)
  const initialSha = useRef<string | null>(null)

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch("/api/version")
        const data = await res.json()

        if (initialSha.current === null) {
          initialSha.current = data.sha
        } else if (data.sha !== initialSha.current) {
          setNewVersion(true)
        }
      } catch {
        // Ignore fetch errors
      }
    }

    checkVersion()
    const interval = setInterval(checkVersion, 15000)
    return () => clearInterval(interval)
  }, [])

  if (!newVersion) return null

  return (
    <button
      onClick={() => window.location.reload()}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors animate-in slide-in-from-bottom-4"
    >
      <RefreshCw className="h-4 w-4" />
      New version deployed — click to refresh
    </button>
  )
}
