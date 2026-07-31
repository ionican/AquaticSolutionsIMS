import { NextResponse } from "next/server"

import { BUILD_PR_LIMIT, selectBuildPrs, parseBuildTime, type BuildInfo } from "@/lib/build-info"
import { requireApiUser } from "@/lib/auth"

// Always execute so the response reflects the running build rather than a
// snapshot frozen at prerender. GitHub traffic is capped by the fetch-level
// revalidate below, not by caching this route.
export const dynamic = "force-dynamic"

const PULLS_URL =
  "https://api.github.com/repos/ionican/AquaticSolutionsIMS/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=100"

// Unauthenticated GitHub allows 60 requests/hour per IP, and serverless egress
// IPs are shared, so one upstream call per hour is the budget.
const REVALIDATE_SECONDS = 3600

export async function GET() {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || ""
  const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA || ""

  const parsedBuildTime = parseBuildTime(buildTime)

  const base: BuildInfo = {
    buildTime: parsedBuildTime ? parsedBuildTime.toISOString() : null,
    commitSha: commitSha || null,
    prs: [],
    prLimit: BUILD_PR_LIMIT,
    filteredByBuildTime: parsedBuildTime !== null,
    error: null,
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "AquaticSolutionsIMS-build-info",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  // Optional. Raises the rate limit when present; never required, and never
  // written to an env file.
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const response = await fetch(PULLS_URL, {
      headers,
      next: { revalidate: REVALIDATE_SECONDS },
    })

    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining")
      const rateLimited = response.status === 403 && remaining === "0"
      return NextResponse.json({
        ...base,
        error: rateLimited
          ? "GitHub rate limit reached. The list will be available again shortly."
          : `GitHub returned ${response.status} ${response.statusText}`.trim(),
      })
    }

    const payload = await response.json()
    if (!Array.isArray(payload)) {
      return NextResponse.json({
        ...base,
        error: "GitHub returned an unexpected response shape.",
      })
    }

    return NextResponse.json({
      ...base,
      prs: selectBuildPrs(payload, base.buildTime),
    })
  } catch (error) {
    // Network failure, DNS, abort. Never invent PR data to fill the gap.
    return NextResponse.json({
      ...base,
      error: error instanceof Error ? `Could not reach GitHub: ${error.message}` : "Could not reach GitHub.",
    })
  }
}
