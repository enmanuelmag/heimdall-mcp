export type TransportType = 'stdio' | 'http' | 'sse'
export type StoreType = 'sqlite' | 'postgres' | 'mysql'
export type SpanStatus = 'ok' | 'error'

export interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: string | number | null
  method?: string
  params?: unknown
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export interface InboundConfig {
  transport: TransportType
  port?: number
  host?: string
}

export interface OutboundConfig {
  transport: TransportType
  url?: string
  command?: string
  args?: string[]
}

export interface StoreConfig {
  connectionString: string
}

export interface McpProxyConfig {
  inbound: InboundConfig
  outbound: OutboundConfig
  store: StoreConfig
  interceptors?: unknown[]
}

export interface McpSpan {
  id: string
  traceId: string
  spanId: string
  parentId?: string
  name: string
  status: SpanStatus
  startedAt: Date
  endedAt: Date
  durationMs: number
  attributes?: Record<string, unknown>
  events?: McpSpanEvent[]
}

export interface McpSpanEvent {
  name: string
  timestamp: Date
  attributes?: Record<string, unknown>
}

export interface SpanFilters {
  traceId?: string
  spanId?: string
  name?: string
  status?: SpanStatus
  from?: Date
  to?: Date
  limit?: number
}
