import type { McpSpan } from '@/types'

interface OtlpAttribute {
  key: string
  value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean }
}

function toOtlpAttributes(attrs: Record<string, unknown> = {}): OtlpAttribute[] {
  return Object.entries(attrs).map(([key, val]) => {
    if (typeof val === 'string')  return { key, value: { stringValue: val } }
    if (typeof val === 'number' && Number.isInteger(val)) return { key, value: { intValue: String(val) } }
    if (typeof val === 'number')  return { key, value: { doubleValue: val } }
    if (typeof val === 'boolean') return { key, value: { boolValue: val } }
    return { key, value: { stringValue: JSON.stringify(val) } }
  })
}

function toNano(date: Date): string {
  return String(date.getTime() * 1_000_000)
}

function toOtlpSpan(span: McpSpan) {
  return {
    traceId:            span.traceId.padStart(32, '0'),
    spanId:             span.spanId.padStart(16, '0'),
    parentSpanId:       span.parentId?.padStart(16, '0'),
    name:               span.name,
    kind:               3, // CLIENT
    startTimeUnixNano: toNano(span.startedAt),
    endTimeUnixNano:   toNano(span.endedAt),
    attributes:        toOtlpAttributes(span.attributes),
    events: (span.events ?? []).map((e) => ({
      name:              e.name,
      timeUnixNano:      toNano(e.timestamp),
      attributes:        toOtlpAttributes(e.attributes),
    })),
    status: {
      code:    span.status === 'ok' ? 1 : 2,
      message: span.status === 'error' ? 'error' : undefined,
    },
  }
}

export class OtlpExporter {
  constructor(private endpoint: string) {}

  async export(span: McpSpan): Promise<void> {
    const payload = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name',    value: { stringValue: 'heimdall-mcp' } },
            { key: 'service.version', value: { stringValue: '0.1.0' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'heimdall-mcp' },
          spans: [toOtlpSpan(span)],
        }],
      }],
    }

    try {
      const res = await fetch(this.endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        process.stderr.write(`[heimdall-mcp] OTLP export failed: HTTP ${res.status}\n`)
      }
    } catch (err) {
      process.stderr.write(`[heimdall-mcp] OTLP export error: ${err}\n`)
    }
  }
}
