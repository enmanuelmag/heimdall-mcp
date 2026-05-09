import { LogEmitter } from './LogEmitter'
import { McpSpanBuilder } from './McpSpanBuilder'
import { MetricsRecorder } from './MetricsRecorder'

import type { SpanInput } from './McpSpanBuilder'
import type { TraceStore } from '@/store/TraceStore'

export type { SpanInput }

export class TelemetryCollector {
  private spanBuilder = new McpSpanBuilder()
  private metrics = new MetricsRecorder()
  private log = new LogEmitter()

  constructor(private store: TraceStore) {}

  async record(input: SpanInput): Promise<void> {
    const span = this.spanBuilder.build(input)

    const toolName = (input.request.params as { name?: string } | undefined)?.name
    if (input.request.method === 'tools/call' && toolName) {
      this.metrics.record(toolName, input.status, input.durationMs)
    }

    const meta: Record<string, unknown> = { traceId: span.traceId, spanId: span.spanId }
    if (input.status === 'error' && input.response.error) {
      meta['error'] = input.response.error
    }
    this.log.debug(`${span.name} [${input.status}] ${input.durationMs}ms`, meta)

    try {
      await this.store.save(span)
    } catch (err) {
      this.log.error('Failed to save span', { err: String(err) })
    }
  }

  getMetrics() {
    return this.metrics.getAll()
  }
}
