import type { McpSpan, SpanFilters } from '@/types'

export interface TraceStore {
  save(span: McpSpan): Promise<void>
  query(filters: SpanFilters): Promise<McpSpan[]>
  close(): Promise<void>
}
