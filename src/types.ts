import type { HttpOutbound } from './transport/HttpOutbound';
import type { SseOutbound } from './transport/SseOutbound';
import type { StdioOutbound } from './transport/StdioOutbound';

export type TransportType = 'stdio' | 'http' | 'sse';
export type StoreType = 'sqlite' | 'postgres' | 'mysql';
export type SpanStatus = 0 | 1 | 2; // 0=UNSET, 1=OK, 2=ERROR
export type BodyMode = 'full' | 'redacted' | 'hash';
export type ServerInfo = { name?: string; version?: string };

export type McpTransportOutbound = StdioOutbound | HttpOutbound | SseOutbound;

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

export interface SpanEvent {
  name: string;
  time?: number | HrTime;
  timestamp?: Date;
  timeUnixNano?: number;
  attributes?: Record<string, unknown>;
}

export type HrTime = [number, number];

export interface SpanLink {
  traceId?: string;
  spanId?: string;
  context?: { traceId: string; spanId: string };
  attributes?: Record<string, unknown>;
}

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
  events?: SpanEvent[];
  links?: SpanLink[];
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

export interface SpanInput {
  request: JsonRpcMessage;
  response: JsonRpcMessage;
  status: 'ok' | 'error';
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
}
