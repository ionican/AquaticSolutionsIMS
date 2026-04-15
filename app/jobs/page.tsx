"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCallback, useEffect, useState } from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface Job {
  id: number
  enquiry_id: number
  project_name: string
  site: string
  site_pcode: string
  status: string
  enquiry_date: string
  contract_start: string
  contract_end: string
  quotation_value: number
  ordervalue: number
  order_number: string
  nature: string
  source: string
  clients: { business_name: string } | null
  contacts: { fname: string; sname: string } | null
  job_types: { job_type: string } | null
  job_classes: { job_class: string } | null
}

interface Filters {
  statuses: string[]
  jobTypes: { job_type_id: number; job_type: string }[]
  jobClasses: { job_class_id: number; job_class: string }[]
}

type SortDir = "asc" | "desc"

const SORTABLE_COLUMNS = [
  { key: "enquiry_id", label: "Enquiry" },
  { key: "project_name", label: "Project" },
  { key: "site", label: "Site" },
  { key: "status", label: "Status" },
  { key: "enquiry_date", label: "Date" },
  { key: "contract_start", label: "Start" },
  { key: "quotation_value", label: "Quote" },
  { key: "ordervalue", label: "Order" },
]

const PAGE_SIZES = [10, 20, 30, 50, 100]

function formatDate(val: string | null) {
  if (!val) return ""
  return new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
}

function formatCurrency(val: number | null) {
  if (val == null) return ""
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(val)
}

const STATUS_COLORS: Record<string, string> = {
  "Contact":    "bg-amber-100 text-amber-800",
  "Enquiry":    "bg-yellow-100 text-yellow-800",
  "Quoting":    "bg-orange-100 text-orange-800",
  "Quoted":     "bg-blue-100 text-blue-800",
  "Contracted": "bg-green-100 text-green-800",
  "Lost":       "bg-red-100 text-red-800",
  "Completed":  "bg-gray-100 text-gray-700",
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"
  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-medium leading-none", cls)}>
      {status}
    </span>
  )
}

function SortIcon({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: SortDir }) {
  if (sortBy !== col) return <ChevronsUpDown className="inline h-3 w-3 ml-0.5 text-muted-foreground/50" />
  return sortDir === "asc"
    ? <ChevronUp className="inline h-3 w-3 ml-0.5 text-primary" />
    : <ChevronDown className="inline h-3 w-3 ml-0.5 text-primary" />
}

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({ statuses: [], jobTypes: [], jobClasses: [] })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sortBy, setSortBy] = useState("enquiry_id")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [jobTypeFilter, setJobTypeFilter] = useState("")
  const [jobClassFilter, setJobClassFilter] = useState("")

  // Load filter options once
  useEffect(() => {
    fetch("/api/jobs/filters")
      .then(r => r.json())
      .then(setFilters)
      .catch(() => {})
  }, [])

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortDir,
      search,
      status: statusFilter,
      jobType: jobTypeFilter,
      jobClass: jobClassFilter,
    })
    try {
      const res = await fetch(`/api/jobs?${params}`)
      const data = await res.json()
      setJobs(data.data || [])
      setTotal(data.count || 0)
    } catch {
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, sortBy, sortDir, search, statusFilter, jobTypeFilter, jobClassFilter])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Reset to page 1 when filters/sort change
  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, jobTypeFilter, jobClassFilter, sortBy, sortDir, pageSize])

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortBy(col)
      setSortDir("asc")
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
  }

  function clearSearch() {
    setSearchInput("")
    setSearch("")
  }

  const totalPages = Math.ceil(total / pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  function clearFilters() {
    setSearch("")
    setSearchInput("")
    setStatusFilter("")
    setJobTypeFilter("")
    setJobClassFilter("")
  }

  const hasFilters = search || statusFilter || jobTypeFilter || jobClassFilter

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
            <p className="text-sm text-muted-foreground">
              {total > 0 ? `${total.toLocaleString()} records` : "No records found"}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search project, site, order..."
              className="pl-8 pr-8 h-8 w-64 text-sm"
            />
            {searchInput && (
              <button type="button" onClick={clearSearch} className="absolute right-2">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </form>

          <Select value={statusFilter || "all"} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {filters.statuses.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={jobTypeFilter || "all"} onValueChange={v => setJobTypeFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {filters.jobTypes.map(t => (
                <SelectItem key={t.job_type_id} value={String(t.job_type_id)}>{t.job_type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={jobClassFilter || "all"} onValueChange={v => setJobClassFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {filters.jobClasses.map(c => (
                <SelectItem key={c.job_class_id} value={String(c.job_class_id)}>{c.job_class}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}


        </div>

        {/* Table */}
        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full min-w-max text-xs">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th onClick={() => handleSort("enquiry_id")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground">
                    Enquiry<SortIcon col="enquiry_id" sortBy={sortBy} sortDir={sortDir} />
                  </th>
                  <th className="px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Client</th>
                  <th onClick={() => handleSort("project_name")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground">
                    Project<SortIcon col="project_name" sortBy={sortBy} sortDir={sortDir} />
                  </th>
                  <th onClick={() => handleSort("site")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground">
                    Site<SortIcon col="site" sortBy={sortBy} sortDir={sortDir} />
                  </th>
                  <th onClick={() => handleSort("status")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground">
                    Status<SortIcon col="status" sortBy={sortBy} sortDir={sortDir} />
                  </th>
                  <th onClick={() => handleSort("enquiry_date")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground">
                    Date<SortIcon col="enquiry_date" sortBy={sortBy} sortDir={sortDir} />
                  </th>
                  <th onClick={() => handleSort("contract_start")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground">
                    Start<SortIcon col="contract_start" sortBy={sortBy} sortDir={sortDir} />
                  </th>
                  <th onClick={() => handleSort("quotation_value")} className="px-2 py-2 text-right font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground">
                    Quote<SortIcon col="quotation_value" sortBy={sortBy} sortDir={sortDir} />
                  </th>
                  <th onClick={() => handleSort("ordervalue")} className="px-2 py-2 text-right font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground">
                    Order<SortIcon col="ordervalue" sortBy={sortBy} sortDir={sortDir} />
                  </th>
                  <th className="px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Contact</th>
                  <th className="px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Type</th>
                  <th className="px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Class</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                      No jobs found
                    </td>
                  </tr>
                ) : (
                  jobs.map((job, i) => (
                    <tr
                      key={job.id}
                      onClick={() => {
                        const isIncomplete = !job.clients?.business_name || !job.project_name || !job.site
                        router.push(isIncomplete ? `/jobs/new?id=${job.id}` : `/jobs/${job.id}`)
                      }}
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-muted/40 transition-colors cursor-pointer",
                        i % 2 === 0 ? "bg-background" : "bg-muted/20"
                      )}
                    >
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{job.enquiry_id}</td>
                      <td className="px-2 py-1.5 max-w-[160px] truncate text-muted-foreground" title={job.clients?.business_name}>
                        {job.clients?.business_name}
                      </td>
                      <td className="px-2 py-1.5 max-w-[200px] truncate font-medium text-foreground" title={job.project_name}>
                        {job.project_name || <span className="text-muted-foreground italic">Untitled</span>}
                      </td>
                      <td className="px-2 py-1.5 max-w-[160px] truncate text-muted-foreground" title={job.site}>
                        {job.site}
                      </td>
                      <td className="px-2 py-1.5">
                        {job.status ? <StatusBadge status={job.status} /> : null}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{formatDate(job.enquiry_date)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{formatDate(job.contract_start)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                        {formatCurrency(job.quotation_value)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                        {formatCurrency(job.ordervalue)}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                        {job.contacts ? `${job.contacts.fname ?? ""} ${job.contacts.sname ?? ""}`.trim() : ""}
                      </td>
                      <td className="px-2 py-1.5 max-w-[120px] truncate text-muted-foreground">
                        {job.job_types?.job_type}
                      </td>
                      <td className="px-2 py-1.5 max-w-[120px] truncate text-muted-foreground">
                        {job.job_classes?.job_class}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">|</span>
              <span className="text-xs text-muted-foreground">Rows:</span>
              <div className="flex items-center gap-1">
                {PAGE_SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => setPageSize(s)}
                    className={cn(
                      "h-6 min-w-[28px] px-1.5 rounded text-xs font-medium border transition-colors",
                      pageSize === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-3 w-3" />
                <ChevronLeft className="h-3 w-3 -ml-2" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs px-2 text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-3 w-3" />
                <ChevronRight className="h-3 w-3 -ml-2" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
