import type { TraceStore } from '@/store/TraceStore';
import type { StoredSpan } from '@/types';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

export class DatabaseSpanProcessor implements DatabaseSpanProcessor {
  constructor(private store: TraceStore) {}

  async onStart(_span: ReadableSpan): Promise<void> {
    // Opcional: hacer algo cuando el span inicia
    // Por ahora no necesitamos nada
  }

  async onEnd(span: ReadableSpan): Promise<void> {
    // Convertir ReadableSpan (OTLP) a McpSpan (tu schema)
    // Guardar en DB
    const storedSpan: StoredSpan = DatabaseSpanProcessor.parseSpanToDbFormat(span);
    await this.store.saveSpan(storedSpan).catch((err) => {
      console.error('[heimdall-mcp] Failed to save span to DB:', err);
    });
  }

  async shutdown(): Promise<void> {
    await this.store.close();
  }

  async forceFlush(_timeout?: number): Promise<void> {}

  static parseSpanToDbFormat(span: ReadableSpan): StoredSpan {
    const spanContext = span.spanContext();

    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      name: span.name,
      kind: span.kind,
      status: span.status.code,
      statusMessage: span.status.message || null,
      startTimeUnixNano: span.startTime[0] * 1e9 + span.startTime[1],
      endTimeUnixNano: span.endTime[0] * 1e9 + span.endTime[1],
      attributes: span.attributes,
      events: span.events,
      links: span.links,
      resourceAttributes: span.resource?.attributes || {},
    };
  }
}
