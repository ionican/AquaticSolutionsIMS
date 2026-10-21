import { execSync } from "node:child_process"

// Build identity, captured when this config is evaluated (i.e. at build time)
// and inlined into the bundles via `env` below.
//
// Both values are memoised onto process.env so that a re-evaluation of this
// config inside the same build (Next loads it more than once in some setups)
// cannot hand the server and client bundles different values. Presetting either
// variable externally overrides the capture, which is useful for testing the
// "older deployment shows fewer PRs" behaviour locally.
function resolveBuildTime() {
  const cached = process.env.NEXT_PUBLIC_BUILD_TIME
  if (cached) return cached
  const now = new Date().toISOString()
  process.env.NEXT_PUBLIC_BUILD_TIME = now
  return now
}

function resolveCommitSha() {
  const cached = process.env.NEXT_PUBLIC_COMMIT_SHA
  if (cached) return cached

  let sha = process.env.VERCEL_GIT_COMMIT_SHA || ""
  if (!sha) {
    try {
      sha = execSync("git rev-parse HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim()
    } catch {
      // No git, no Vercel metadata - the UI degrades to hiding the commit.
      sha = ""
    }
  }

  process.env.NEXT_PUBLIC_COMMIT_SHA = sha
  return sha
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: resolveBuildTime(),
    NEXT_PUBLIC_COMMIT_SHA: resolveCommitSha(),
  },
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
