import type { SpanFilters, StoredSpan } from '@/types';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

export interface TraceStore {
  /**
   * Guardar ReadableSpan en formato OTLP nativo
   * Convierte automáticamente a serialización de BD
   */
  save(span: ReadableSpan): Promise<void>;

  /**
   * Recuperar spans de BD en formato OTLP nativo (StoredSpan)
   * Compatible con UIs OTLP: Jaeger, Grafana, SigNoz, etc.
   */
  query(filters: SpanFilters): Promise<StoredSpan[]>;

  close(): Promise<void>;
}
