"use client"

import { Suspense, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Invite/reset emails with the default Supabase templates redirect to the
  // site root with tokens in tow; unauthenticated, that lands here (the URL
  // fragment survives the proxy's redirect). Hand the tokens to /auth/confirm.
  useEffect(() => {
    const hash = window.location.hash
    const search = new URLSearchParams(window.location.search)
    if (
      hash.includes("access_token=") ||
      hash.includes("error_description=") ||
      search.has("token_hash") ||
      search.has("code")
    ) {
      window.location.replace(`/auth/confirm${window.location.search}${hash}`)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const supabase = createSupabaseBrowserClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError("Incorrect email or password")
      setSubmitting(false)
      return
    }

    // Only allow same-origin redirect targets. Resolving against our origin
    // and comparing catches every external form — full URLs, //host, and
    // backslash tricks like /\evil.example that a prefix check lets through.
    const redirect = searchParams.get("redirect")
    let target = "/"
    if (redirect) {
      try {
        const resolved = new URL(redirect, window.location.origin)
        if (resolved.origin === window.location.origin) {
          target = resolved.pathname + resolved.search + resolved.hash
        }
      } catch {
        // Unparseable — fall through to "/"
      }
    }

    router.replace(target)
    router.refresh()
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <Image
          src="/brand/aquatic-solutions-header-icon.png"
          alt=""
          width={40}
          height={40}
          className="size-10"
          priority
        />
        <CardTitle>Project Manager</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/auth/forgot" className="underline">
              Forgotten password?
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}
