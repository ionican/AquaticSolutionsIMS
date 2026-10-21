// Shared types and pure helpers for the build stamp.
// Imported by both the /api/build-info route and the client component, so this
// module must stay free of server-only imports.

export const BUILD_PR_LIMIT = 20

export type BuildPr = {
  number: number
  title: string
  merged_at: string
  html_url: string
  user: { login: string }
}

export type BuildInfo = {
  // ISO string captured at build time, or null when it could not be determined.
  buildTime: string | null
  commitSha: string | null
  prs: BuildPr[]
  prLimit: number
  // Provenance: false means the build time was missing/unparseable, so the
  // "merged before this build" cut could not be applied and the list is simply
  // the most recent merges.
  filteredByBuildTime: boolean
  error: string | null
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}

// Everything is formatted in UTC by hand rather than through toLocaleString /
// Intl. The nav is server-rendered before it hydrates, so a locale- or
// timezone-dependent format would produce a hydration mismatch whenever the
// server and the browser disagree.
export function parseBuildTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function shortSha(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 7) : null
}

// "30 Jul 15:02"
export function formatStamp(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

// "30 Jul" - narrow screens
export function formatStampShort(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

// "30 Jul 2026, 15:02 UTC"
export function formatTimestamp(date: Date): string {
  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
  return `${day}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
}

// "30 Jul 2026"
export function formatMergedDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "unknown date"
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

function toBuildPr(raw: unknown): BuildPr | null {
  if (!raw || typeof raw !== "object") return null
  const pr = raw as Record<string, unknown>

  // Unmerged closed PRs carry merged_at: null and are not part of any build.
  if (typeof pr.merged_at !== "string" || !pr.merged_at) return null
  if (typeof pr.number !== "number") return null
  if (typeof pr.html_url !== "string" || !pr.html_url) return null
  if (Number.isNaN(new Date(pr.merged_at).getTime())) return null

  const user = pr.user as { login?: unknown } | null | undefined
  const login = user && typeof user.login === "string" ? user.login : "unknown"

  return {
    number: pr.number,
    title: typeof pr.title === "string" && pr.title ? pr.title : `Pull request #${pr.number}`,
    merged_at: pr.merged_at,
    html_url: pr.html_url,
    user: { login },
  }
}

// Keep merged PRs that landed at or before the build time, newest first, capped.
// The build-time cut is the point of the feature: an older deployment shows
// fewer PRs rather than whatever the newest 20 happen to be today.
export function selectBuildPrs(raw: unknown, buildTime: string | null): BuildPr[] {
  if (!Array.isArray(raw)) return []

  const cutoff = parseBuildTime(buildTime)
  const cutoffMs = cutoff ? cutoff.getTime() : null

  const prs: BuildPr[] = []
  for (const item of raw) {
    const pr = toBuildPr(item)
    if (!pr) continue
    if (cutoffMs !== null && new Date(pr.merged_at).getTime() > cutoffMs) continue
    prs.push(pr)
  }

  prs.sort((a, b) => new Date(b.merged_at).getTime() - new Date(a.merged_at).getTime())
  return prs.slice(0, BUILD_PR_LIMIT)
}
