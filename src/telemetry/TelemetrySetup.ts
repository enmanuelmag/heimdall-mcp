import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { DatabaseSpanProcessor } from './DatabaseSpanProcessor';
import { createOtelResource } from './OtelResource';

import type { TraceStore } from '@/store/TraceStore';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';

export function initializeTelemetry(
  store: TraceStore,
  options?: {
    otlpEndpoint?: string;
    debug?: boolean;
  }
) {
  const spanProcessors: SpanProcessor[] = [new DatabaseSpanProcessor(store)];

  if (options?.otlpEndpoint) {
    const otlpExporter = new OTLPTraceExporter({
      url: options.otlpEndpoint,
    });
    // BatchSpanProcessor = agrupa spans + envía cada N milisegundos o N spans
    spanProcessors.push(new BatchSpanProcessor(otlpExporter));
  }

  if (options?.debug) {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  const tracerProvider = new NodeTracerProvider({
    resource: createOtelResource(),
    spanProcessors,
  });

  trace.setGlobalTracerProvider(tracerProvider);

  return tracerProvider;
}
