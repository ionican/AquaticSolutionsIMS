"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, Database, Table, AlertCircle, CheckCircle2, Loader2, Plus, X } from "lucide-react"

type MigrationStatus = "idle" | "fetching-schema" | "ready" | "migrating" | "success" | "error"

interface Column {
  name: string
  type: string
  nullable: boolean
  selected: boolean
}

interface TableInfo {
  name: string
  sourceName?: string
  schema: string
  columnCount: number
  rowCount: number
  currentRowCount: number
  hasAuditTrail: boolean
  columns: Column[]
}

interface TableMigrationStatus extends TableInfo {
  migrationStatus: "pending" | "migrating" | "success" | "error"
  migratedRows?: number
  error?: string
}

interface AvailableTable {
  name: string
  schema: string
  columnCount: number
}

export default function ImportPage() {
  const [status, setStatus] = useState<MigrationStatus>("idle")
  const [tables, setTables] = useState<TableMigrationStatus[]>([])
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [connectionConfigured, setConnectionConfigured] = useState<boolean | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [blockedIp, setBlockedIp] = useState<string | null>(null)
  const [savingConfig, setSavingConfig] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showAddTable, setShowAddTable] = useState(false)
  const [availableTables, setAvailableTables] = useState<AvailableTable[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [addingTable, setAddingTable] = useState<string | null>(null)

  const checkConnection = async () => {
    setConnectionConfigured(null)
    setConnectionError(null)
    setBlockedIp(null)
    try {
      const response = await fetch("/api/migration/check-connection")
      const data = await response.json()
      if (data.firewallBlocked) {
        setConnectionConfigured(false)
        setBlockedIp(data.blockedIp)
        setConnectionError(data.error)
      } else if (data.error) {
        setConnectionConfigured(false)
        setConnectionError(data.error)
      } else {
        setConnectionConfigured(data.configured)
      }
    } catch {
      setConnectionConfigured(false)
    }
  }

  const copyIp = () => {
    if (blockedIp) {
      navigator.clipboard.writeText(blockedIp)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const fetchSchema = async () => {
    setStatus("fetching-schema")
    setErrorMessage(null)
    
    try {
      const response = await fetch("/api/migration/fetch-schema")
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch schema")
      }
      
      // Fetch saved configuration and apply it
      const tablesWithConfig = await Promise.all(
        data.tables.map(async (t: any) => {
          const configResponse = await fetch(`/api/migration/column-config?table=${t.name}`)
          const configData = await configResponse.json()
          const savedConfig = configData.config || []
          
          return {
            name: t.name,
            sourceName: t.sourceName,
            schema: 'dbo',
            columnCount: t.columns.filter((c: any) => !c.isAuditColumn).length,
            rowCount: t.totalRowCount,
            currentRowCount: t.currentRowCount,
            hasAuditTrail: t.hasAuditTrail,
            columns: t.columns.filter((c: any) => !c.isAuditColumn).map((col: any) => {
              const savedSelection = savedConfig.find((s: any) => s.column_name === col.name)
              return {
                name: col.name,
                type: col.postgresType,
                nullable: col.isNullable,
                selected: savedSelection ? savedSelection.selected : true
              }
            }),
            migrationStatus: "pending" as const
          }
        })
      )

      setTables(tablesWithConfig)
      setStatus("ready")
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch schema")
    }
  }

  const toggleTable = (tableName: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev)
      if (next.has(tableName)) {
        next.delete(tableName)
      } else {
        next.add(tableName)
      }
      return next
    })
  }

  const toggleColumn = (tableName: string, columnName: string) => {
    setTables(prev => prev.map(table => {
      if (table.name === tableName) {
        return {
          ...table,
          columns: table.columns.map(col => 
            col.name === columnName ? { ...col, selected: !col.selected } : col
          )
        }
      }
      return table
    }))
  }

  const fetchAvailableTables = async () => {
    setLoadingAvailable(true)
    try {
      const response = await fetch("/api/migration/available-tables")
      const data = await response.json()
      if (data.success) {
        setAvailableTables(data.tables)
      }
    } catch {
      // Ignore errors
    }
    setLoadingAvailable(false)
  }

  const handleShowAddTable = async () => {
    setShowAddTable(true)
    await fetchAvailableTables()
  }

  const addTable = async (sourceTableName: string) => {
    setAddingTable(sourceTableName)
    try {
      const response = await fetch("/api/migration/fetch-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables: [sourceTableName] })
      })
      const data = await response.json()

      if (data.success && data.tables.length > 0) {
        const t = data.tables[0]
        const newTable: TableMigrationStatus = {
          name: t.name,
          sourceName: t.sourceName,
          schema: 'dbo',
          columnCount: t.columns.filter((c: any) => !c.isAuditColumn).length,
          rowCount: t.totalRowCount,
          currentRowCount: t.currentRowCount,
          hasAuditTrail: t.hasAuditTrail,
          columns: t.columns.filter((c: any) => !c.isAuditColumn).map((col: any) => ({
            name: col.name,
            type: col.postgresType,
            nullable: col.isNullable,
            selected: true
          })),
          migrationStatus: "pending"
        }
        setTables(prev => [...prev, newTable])
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add table")
    }
    setAddingTable(null)
    setShowAddTable(false)
  }

  const removeTable = (tableName: string) => {
    setTables(prev => prev.filter(t => t.name !== tableName))
  }

  const saveColumnConfig = async (tableName: string) => {
    setSavingConfig(tableName)
    try {
      const table = tables.find(t => t.name === tableName)
      if (!table) throw new Error("Table not found")

      const response = await fetch("/api/migration/column-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName,
          columns: table.columns
        })
      })

      if (!response.ok) throw new Error("Failed to save configuration")
      
      // Visual feedback
      setTimeout(() => setSavingConfig(null), 1000)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save configuration")
      setSavingConfig(null)
    }
  }

  const startMigration = async () => {
    setStatus("migrating")
    setErrorMessage(null)
    
    setTables(prev => prev.map(t => ({ ...t, migrationStatus: "pending" as const })))
    
    try {
      const response = await fetch("/api/migration/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          tables: tables.map(t => ({
            name: t.name,
            selectedColumns: t.columns.filter(c => c.selected).map(c => c.name)
          }))
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Migration failed")
      }
      
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response stream")
      
      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const text = decoder.decode(value)
        const lines = text.split("\n").filter(Boolean)
        
        for (const line of lines) {
          try {
            const event = JSON.parse(line)
            
            if (event.type === "table") {
              setTables(prev => 
                prev.map(t => 
                  t.name === event.table 
                    ? { 
                        ...t, 
                        migrationStatus: event.status, 
                        migratedRows: event.rowCount, 
                        error: event.error 
                      }
                    : t
                )
              )
            } else if (event.type === "error") {
              setErrorMessage(event.message)
              setStatus("error")
            } else if (event.type === "complete") {
              setStatus("success")
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "An error occurred")
    }
  }

  useEffect(() => {
    checkConnection()
  }, [])

  const totalRows = tables.reduce((sum, t) => sum + t.currentRowCount, 0)
  const migratedTables = tables.filter(t => t.migrationStatus === "success").length

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Database Migration</h1>
            <p className="text-muted-foreground">
              Import data from Azure SQL Server to Supabase
            </p>
          </div>
        </div>
        
        <div className="mt-8 space-y-6">
          {/* Connection Status */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-card-foreground">Step 1: Connection Status</h2>
            
            {connectionConfigured === null ? (
              <div className="mt-3 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking connection...</span>
              </div>
            ) : connectionConfigured ? (
              <div className="mt-3 flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span>Azure SQL connection configured and reachable</span>
              </div>
            ) : blockedIp ? (
              <div className="mt-3 space-y-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>Azure SQL firewall is blocking access</span>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">Add this IP address to your Azure SQL firewall:</p>
                  <div className="mt-2 flex items-center gap-3">
                    <code className="flex-1 rounded bg-white border border-amber-200 px-3 py-2 font-mono text-lg font-bold text-amber-900">
                      {blockedIp}
                    </code>
                    <Button onClick={copyIp} variant="outline" size="sm" className="shrink-0">
                      {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : "Copy"}
                    </Button>
                  </div>
                  <ol className="mt-3 text-xs text-amber-800 space-y-1 list-decimal list-inside">
                    <li>Go to Azure Portal &gt; SQL Server &gt; <strong>Networking</strong></li>
                    <li>Add a firewall rule for the IP address above</li>
                    <li>Click <strong>Save</strong> and wait up to 5 minutes</li>
                    <li>Click <strong>Check Again</strong> below</li>
                  </ol>
                </div>
                <Button onClick={checkConnection} variant="outline" size="sm">
                  Check Again
                </Button>
              </div>
            ) : connectionError ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>Connection failed</span>
                </div>
                <p className="text-sm text-muted-foreground">{connectionError}</p>
                <Button onClick={checkConnection} variant="outline" size="sm">
                  Check Again
                </Button>
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>Azure SQL connection not configured</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Please add the following environment variables in Settings &gt; Vars:
                </p>
                <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs">AZURE_SQL_SERVER</code></li>
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs">AZURE_SQL_DATABASE</code></li>
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs">AZURE_SQL_USER</code></li>
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs">AZURE_SQL_PASSWORD</code></li>
                </ul>
                <Button onClick={checkConnection} variant="outline" size="sm" className="mt-4">
                  Check Again
                </Button>
              </div>
            )}
          </div>
          
          {/* Schema Fetch */}
          {connectionConfigured && (
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">Step 2: Select Columns</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose which columns to import from each table
                  </p>
                </div>
                {status === "idle" && (
                  <Button onClick={fetchSchema}>
                    Fetch Schema
                  </Button>
                )}
                {status === "fetching-schema" && (
                  <Button disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching...
                  </Button>
                )}
              </div>
              
              {tables.length > 0 && (
                <div className="mt-6">
                  <div className="mb-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {tables.length} tables, {totalRows.toLocaleString()} total rows to migrate
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground">
                        Note: Only current records (Superceded IS NULL) will be imported
                      </span>
                      <Button onClick={handleShowAddTable} variant="outline" size="sm">
                        <Plus className="mr-1 h-3 w-3" />
                        Add Table
                      </Button>
                    </div>
                  </div>

                  {/* Add Table Panel */}
                  {showAddTable && (
                    <div className="mb-4 rounded-md border border-border bg-muted/20 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-foreground">Select a table to add</h3>
                        <Button onClick={() => setShowAddTable(false)} variant="ghost" size="sm">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {loadingAvailable ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading available tables...
                        </div>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {availableTables
                            .filter(at => !tables.some(t => (t.sourceName || t.name) === at.name))
                            .map(at => (
                              <button
                                key={at.name}
                                onClick={() => addTable(at.name)}
                                disabled={addingTable !== null}
                                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
                              >
                                {addingTable === at.name ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                ) : (
                                  <Table className="h-3 w-3 text-primary" />
                                )}
                                <span className="font-medium">{at.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{at.columnCount} cols</span>
                              </button>
                            ))}
                          {availableTables.filter(at => !tables.some(t => (t.sourceName || t.name) === at.name)).length === 0 && (
                            <p className="text-sm text-muted-foreground col-span-full">All available tables are already added.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    {tables.map((table) => {
                      const selectedCount = table.columns.filter(c => c.selected).length
                      return (
                        <div
                          key={table.name}
                          className="rounded-md border border-border overflow-hidden"
                        >
                          <div className="flex w-full items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                            <button
                              onClick={() => toggleTable(table.name)}
                              className="flex items-center gap-3 flex-1"
                            >
                              {expandedTables.has(table.name) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <Table className="h-4 w-4 text-primary" />
                              <span className="font-medium text-foreground">{table.name}</span>
                              {table.sourceName && table.sourceName !== table.name && (
                                <span className="text-xs text-muted-foreground">({table.sourceName})</span>
                              )}
                              {table.hasAuditTrail && (
                                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                                  Audit Trail
                                </span>
                              )}
                            </button>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-muted-foreground">
                                {selectedCount} of {table.columnCount} columns
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {table.currentRowCount.toLocaleString()} rows
                              </span>
                              {table.migrationStatus === "success" && (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                              {table.migrationStatus === "migrating" && (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              )}
                              {table.migrationStatus === "error" && (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              )}
                              <button
                                onClick={() => removeTable(table.name)}
                                className="ml-2 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                title="Remove table from migration"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          
                          {expandedTables.has(table.name) && (
                            <div className="border-t border-border bg-background px-4 py-3">
                              <div className="space-y-2 mb-4">
                                {table.columns.map((col) => (
                                  <label key={col.name} className="flex items-center gap-3 p-2 hover:bg-muted/30 rounded cursor-pointer">
                                    <input 
                                      type="checkbox"
                                      checked={col.selected}
                                      onChange={() => toggleColumn(table.name, col.name)}
                                      className="w-4 h-4 rounded border-border"
                                    />
                                    <div className="flex-1">
                                      <div className="font-mono text-xs text-foreground">{col.name}</div>
                                      <div className="text-xs text-muted-foreground">{col.type} {col.nullable ? '(nullable)' : '(required)'}</div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                              <Button 
                                onClick={() => saveColumnConfig(table.name)}
                                variant="outline"
                                size="sm"
                                disabled={savingConfig === table.name}
                              >
                                {savingConfig === table.name ? (
                                  <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  "Save Selection"
                                )}
                              </Button>
                              {table.error && (
                                <p className="mt-3 text-sm text-destructive">{table.error}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Migration Controls */}
          {(status === "ready" || status === "migrating" || status === "success" || status === "error") && tables.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">Step 3: Run Migration</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status === "success" 
                      ? `Successfully migrated ${migratedTables} tables`
                      : "Create tables in Supabase and import selected columns"}
                  </p>
                </div>
                <Button 
                  onClick={startMigration}
                  disabled={status === "migrating"}
                  variant={status === "success" ? "outline" : "default"}
                >
                  {status === "migrating" && (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Migrating...
                    </>
                  )}
                  {status === "ready" && "Start Migration"}
                  {status === "success" && "Run Again"}
                  {status === "error" && "Retry Migration"}
                </Button>
              </div>
              
              {errorMessage && (
                <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <p className="text-sm text-destructive">{errorMessage}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
