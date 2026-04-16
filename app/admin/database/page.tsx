"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw, Database, ChevronLeft, ChevronRight } from "lucide-react"

interface TableInfo {
  name: string
  rowCount: number
}

interface TableData {
  data: Record<string, unknown>[]
  columns: string[]
  totalCount: number
  offset: number
  limit: number
}

export default function DatabaseOverviewPage() {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selectedTable, setSelectedTable] = useState<string>("")
  const [tableData, setTableData] = useState<TableData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingTables, setLoadingTables] = useState(true)
  const [page, setPage] = useState(0)
  const pageSize = 100
  
  const parentRef = useRef<HTMLDivElement>(null)
  
  // Fetch list of tables
  const fetchTables = useCallback(async () => {
    setLoadingTables(true)
    try {
      const response = await fetch("/api/database/tables")
      const data = await response.json()
      if (data.success) {
        setTables(data.tables)
      }
    } catch (error) {
      console.error("Failed to fetch tables:", error)
    } finally {
      setLoadingTables(false)
    }
  }, [])
  
  // Fetch table data
  const fetchTableData = useCallback(async (tableName: string, offset: number = 0) => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/database/tables/${tableName}?offset=${offset}&limit=${pageSize}`
      )
      const data = await response.json()
      if (data.success) {
        setTableData(data)
      }
    } catch (error) {
      console.error("Failed to fetch table data:", error)
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    fetchTables()
  }, [fetchTables])
  
  useEffect(() => {
    if (selectedTable) {
      setPage(0)
      fetchTableData(selectedTable, 0)
    } else {
      setTableData(null)
    }
  }, [selectedTable, fetchTableData])
  
  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchTableData(selectedTable, newPage * pageSize)
  }
  
  const rowVirtualizer = useVirtualizer({
    count: tableData?.data.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })
  
  const totalPages = tableData ? Math.ceil(tableData.totalCount / pageSize) : 0
  
  // Get display-friendly column order (id first, then alphabetical)
  const orderedColumns = tableData?.columns 
    ? [...tableData.columns].sort((a, b) => {
        if (a === 'id') return -1
        if (b === 'id') return 1
        return a.localeCompare(b)
      })
    : []

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Database Overview</h1>
            <p className="mt-2 text-muted-foreground">
              Browse and inspect database tables
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={fetchTables}
            disabled={loadingTables}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingTables ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        {/* Table Selector */}
        <div className="mt-8 flex items-center gap-4">
          <Database className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a table..." />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.name} value={table.name}>
                  {table.name} ({table.rowCount.toLocaleString()} rows)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {tableData && (
            <span className="text-sm text-muted-foreground">
              Showing {tableData.offset + 1}-{Math.min(tableData.offset + tableData.data.length, tableData.totalCount)} of {tableData.totalCount.toLocaleString()} rows
            </span>
          )}
        </div>
        
        {/* Table Data View */}
        {selectedTable && (
          <div className="mt-6 rounded-lg border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tableData && tableData.data.length > 0 ? (
              <>
                {/* Table Header */}
                <div className="overflow-x-auto border-b border-border bg-muted/50">
                  <div className="flex min-w-max">
                    {orderedColumns.map((col) => (
                      <div
                        key={col}
                        className="flex-shrink-0 min-w-[120px] max-w-[400px] px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border last:border-r-0"
                      >
                        {col}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Virtualized Table Body */}
                <div
                  ref={parentRef}
                  className="overflow-auto"
                  style={{ height: '500px' }}
                >
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const row = tableData.data[virtualRow.index]
                      return (
                        <div
                          key={virtualRow.key}
                          className="absolute top-0 left-0 w-full flex min-w-max border-b border-border hover:bg-muted/30"
                          style={{
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {orderedColumns.map((col) => {
                            const value = row[col]
                            let displayValue = ''
                            
                            if (value === null || value === undefined) {
                              displayValue = ''
                            } else if (typeof value === 'boolean') {
                              displayValue = value ? 'Yes' : 'No'
                            } else if (value instanceof Date) {
                              displayValue = value.toLocaleDateString()
                            } else if (typeof value === 'object') {
                              displayValue = JSON.stringify(value)
                            } else {
                              displayValue = String(value)
                            }
                            
                            return (
                              <div
                                key={col}
                                className="flex-shrink-0 min-w-[120px] max-w-[400px] px-4 py-2 text-sm text-foreground break-words border-r border-border last:border-r-0"
                                title={displayValue}
                              >
                                {displayValue || <span className="text-muted-foreground/50">null</span>}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                <Database className="h-12 w-12 mb-4 opacity-50" />
                <p>No data in this table</p>
              </div>
            )}
          </div>
        )}
        
        {!selectedTable && (
          <div className="mt-6 rounded-lg border border-border bg-card p-12 text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Select a table from the dropdown to view its data</p>
          </div>
        )}
      </main>
    </div>
  )
}
