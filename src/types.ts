export type TransportType = 'stdio' | 'http' | 'sse';
export type StoreType = 'sqlite' | 'postgres' | 'mysql';
export type SpanStatus = 'ok' | 'error';

export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface InboundConfig {
  transport: TransportType;
  port?: number;
  host?: string;
}

export interface OutboundConfig {
  transport: TransportType;
  url?: string;
  command?: string;
  args?: string[];
}

export interface StoreConfig {
  connectionString: string;
}

export interface McpProxyConfig {
  inbound: InboundConfig;
  outbound: OutboundConfig;
  store: StoreConfig;
  interceptors?: unknown[];
}

/**
 * Span recuperado de BD (serializado en formato OTLP nativo)
 * Compatible con UIs que esperan OTLP (Jaeger, Grafana, SigNoz, etc.)
 * Campos mapean directamente a OpenTelemetry estándar
 */
export interface StoredSpan {
  traceId: string;
  spanId: string;
  name: string;
  kind?: number | null; // 0=INTERNAL, 1=SERVER, 2=CLIENT, 3=PRODUCER, 4=CONSUMER
  status: number; // 0=UNSET, 1=OK, 2=ERROR
  statusMessage?: string | null;
  startTimeUnixNano: number; // unix nanoseconds
  endTimeUnixNano: number; // unix nanoseconds
  attributes?: Record<string, unknown>; // OTLP semantic conventions
  events?: unknown; // Array de eventos OTLP
  links?: unknown; // Array de links OTLP
  resourceAttributes?: Record<string, unknown>; // Metadatos del servicio
}

export interface SpanFilters {
  traceId?: string;
  spanId?: string;
  name?: string;
  status?: SpanStatus;
  from?: Date;
  to?: Date;
  limit?: number;
}
