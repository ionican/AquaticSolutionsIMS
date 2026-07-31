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

// Landing page for Supabase auth emails (invite and password reset).
// Establishes a session from whichever token shape the link carries, then
// requires the user to set a password before continuing:
//   - #access_token=…&refresh_token=…   (implicit flow, the default templates)
//   - ?token_hash=…&type=…              (customised email templates)
//   - ?code=…                           (PKCE links, same-browser only)
type Phase = "verifying" | "set-password" | "error"

function ConfirmForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>("verifying")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    async function establishSession() {
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      )

      // Supabase reports expired/used links as error params.
      const errorDescription =
        hashParams.get("error_description") ?? searchParams.get("error_description")
      if (errorDescription) {
        setErrorMessage(errorDescription)
        setPhase("error")
        return
      }

      try {
        const accessToken = hashParams.get("access_token")
        const refreshToken = hashParams.get("refresh_token")
        const tokenHash = searchParams.get("token_hash")
        const code = searchParams.get("code")

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
        } else if (tokenHash) {
          const type = (searchParams.get("type") ?? "recovery") as
            | "invite"
            | "recovery"
            | "email"
          const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
          })
          if (error) throw error
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else {
          // No token at all — likely an existing session (e.g. page reload
          // after verification). Only proceed if one exists.
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (!user) {
            setErrorMessage("This link is invalid or has already been used.")
            setPhase("error")
            return
          }
        }

        // Drop the tokens from the address bar.
        window.history.replaceState(null, "", "/auth/confirm")
        setPhase("set-password")
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "This link is invalid or has expired."
        )
        setPhase("error")
      }
    }

    establishSession()
    // searchParams is stable for the life of the page; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters")
      return
    }
    if (password !== confirm) {
      setFormError("Passwords do not match")
      return
    }

    setSubmitting(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setFormError(error.message)
      setSubmitting(false)
      return
    }

    router.replace("/")
    router.refresh()
  }

  if (phase === "verifying") {
    return <p className="text-sm text-muted-foreground">Verifying link…</p>
  }

  if (phase === "error") {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
        <p className="text-sm text-muted-foreground">
          Request a new link from the{" "}
          <Link href="/auth/forgot" className="underline">
            password reset page
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSetPassword} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Saving…" : "Set password and sign in"}
      </Button>
    </form>
  )
}

export default function ConfirmPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
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
          <CardTitle>Set your password</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense>
            <ConfirmForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  )
}
