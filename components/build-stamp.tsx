"use client"

import { useCallback, useState } from "react"
import { ChevronDown, TriangleAlert } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  formatMergedDate,
  formatStamp,
  formatStampShort,
  formatTimestamp,
  parseBuildTime,
  shortSha,
  type BuildInfo,
  type BuildPr,
} from "@/lib/build-info"

// Inlined at build time by the `env` block in next.config.mjs. Read with plain
// dot access - Next replaces the literal text, so bracket access or
// destructuring would not be substituted.
const buildDate = parseBuildTime(process.env.NEXT_PUBLIC_BUILD_TIME)
const commit = shortSha(process.env.NEXT_PUBLIC_COMMIT_SHA)

// Two overrides on Radix ScrollArea's internals, both load-bearing:
//  - its viewport is `size-full`, so a max-height on the root alone does not
//    constrain it and a 20-row list spills out below the popover;
//  - its viewport wraps children in a `display: table` box that shrink-wraps to
//    nowrap text, which defeats `truncate`. Forcing that box to `block` gives
//    the rows a definite width to ellipsise against.
const SCROLL_AREA_CLASS =
  "[&>[data-slot=scroll-area-viewport]]:max-h-72 [&>[data-slot=scroll-area-viewport]>div]:block!"

type LoadState = "idle" | "loading" | "ready" | "error"

export function BuildStamp() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<LoadState>("idle")
  const [prs, setPrs] = useState<BuildPr[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState("loading")
    setError(null)

    try {
      const response = await fetch("/api/build-info", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data = (await response.json()) as BuildInfo

      // The route answers 200 with an error string when GitHub is unavailable,
      // so an empty list is only ever shown as "no PRs" when the fetch worked.
      if (data.error) {
        setPrs([])
        setError(data.error)
        setState("error")
        return
      }

      setPrs(Array.isArray(data.prs) ? data.prs : [])
      setState("ready")
    } catch (caught) {
      setPrs([])
      setError(caught instanceof Error ? caught.message : "Unknown error")
      setState("error")
    }
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next && state === "idle") void load()
    },
    [load, state],
  )

  const timestamp = buildDate ? formatTimestamp(buildDate) : "Build time unavailable"
  const triggerLabel = buildDate
    ? `Build ${formatTimestamp(buildDate)}${commit ? `, commit ${commit}` : ""}. Show the pull requests in this build.`
    : "Build time unavailable. Show the pull requests in this build."

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted data-[state=open]:text-foreground"
        >
          {/* The timezone is stated on the trigger itself, not just in the
              popover: the stamp is read at a glance to tell builds apart, and
              an unlabelled time invites reading it as local. */}
          <span className="hidden sm:inline" aria-hidden="true">
            {buildDate ? `Build ${formatStamp(buildDate)} UTC` : "Build unknown"}
          </span>
          <span className="sm:hidden" aria-hidden="true">
            {buildDate ? `Build ${formatStampShort(buildDate)} UTC` : "Build unknown"}
          </span>
          <ChevronDown
            className="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        aria-label="Build details"
        className="w-[min(24rem,calc(100vw-1.5rem))] p-0"
      >
        <div className="px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">{timestamp}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {commit ? (
              <>
                Commit <span className="font-mono">{commit}</span>
              </>
            ) : (
              "Commit unknown"
            )}
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pull requests</h2>
          {state === "ready" && prs.length > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">{prs.length}</span>
          )}
        </div>

        <div className="px-1 pb-2">
          {state === "loading" && (
            <div className="space-y-3 px-2 py-2" role="status" aria-live="polite">
              <span className="sr-only">Loading pull requests</span>
              {[0, 1, 2].map((row) => (
                <div key={row} className="space-y-1.5">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              ))}
            </div>
          )}

          {state === "error" && (
            <div className="px-2 py-3" role="alert">
              <p className="flex items-start gap-2 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>Could not load the pull request list.</span>
              </p>
              <p className="mt-1 pl-6 text-xs break-words text-muted-foreground">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-2.5 ml-6 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try again
              </button>
            </div>
          )}

          {state === "ready" && prs.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No pull requests in this build.</p>
          )}

          {state === "ready" && prs.length > 0 && (
            <ScrollArea className={SCROLL_AREA_CLASS}>
              <ul className="pr-2">
                {prs.map((pr) => (
                  <li key={pr.number}>
                    <a
                      href={pr.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/pr block rounded-md px-2 py-2 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="shrink-0 font-mono text-xs text-primary">#{pr.number}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground group-hover/pr:underline group-focus-visible/pr:underline">
                          {pr.title}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{formatMergedDate(pr.merged_at)}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span className="min-w-0 truncate">{pr.user.login}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
