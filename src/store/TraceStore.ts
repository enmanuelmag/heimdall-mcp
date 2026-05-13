import type { SpanFilters, StoredSpan } from '@/types';

export interface TraceStore {
  /**
   * Guardar ReadableSpan en formato OTLP nativo
   * Convierte automáticamente a serialización de BD
   */
  saveSpan(span: StoredSpan): Promise<void>;

  /**
   * Recuperar spans de BD en formato OTLP nativo (StoredSpan)
   * Compatible con UIs OTLP: Jaeger, Grafana, SigNoz, etc.
   */
  query(filters: SpanFilters): Promise<StoredSpan[]>;

  close(): Promise<void>;
}
