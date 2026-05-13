import type { TraceStore } from '@/store/TraceStore';
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
    await this.store.save(span).catch((err) => {
      console.error('[heimdall-mcp] Failed to save span to DB:', err);
    });
  }

  async shutdown(): Promise<void> {
    await this.store.close();
  }

  async forceFlush(_timeout?: number): Promise<void> {}
}
