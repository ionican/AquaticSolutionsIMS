import { MAX_PAGE_SIZE } from "@/lib/auth-types"

/**
 * Parse and clamp pagination parameters from a URL.
 * Enforces the server-side max page size — callers cannot override it.
 */
export function parsePagination(searchParams: URLSearchParams): {
  page: number
  pageSize: number
  from: number
  to: number
} {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const requestedSize = parseInt(searchParams.get("pageSize") || "25")
  const pageSize = Math.min(Math.max(1, requestedSize), MAX_PAGE_SIZE)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return { page, pageSize, from, to }
}
