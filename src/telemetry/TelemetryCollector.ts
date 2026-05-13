import { SpanStatusCode, trace } from '@opentelemetry/api';

import { pkg } from '@/core/package-data';

import { LogEmitter } from './LogEmitter';
import { MetricsRecorder } from './MetricsRecorder';

import type { JsonRpcMessage } from '@/types';
import type { Attributes } from '@opentelemetry/api';

export interface SpanInput {
  request: JsonRpcMessage;
  response: JsonRpcMessage;
  status: 'ok' | 'error';
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
}

const NAMES: Record<string, string> = {
  initialize: 'mcp.initialize',
  'tools/list': 'mcp.tools.list',
  'tools/call': 'mcp.tool.call',
  'resources/read': 'mcp.resource.read',
  'resources/list': 'mcp.resources.list',
  'prompts/get': 'mcp.prompt.get',
  'prompts/list': 'mcp.prompts.list',
  shutdown: 'mcp.shutdown',
};

export class TelemetryCollector {
  private tracer = trace.getTracer('heimdall-mcp', pkg.version);
  private metrics = new MetricsRecorder();
  private log = new LogEmitter();

  async record(input: SpanInput): Promise<void> {
    const method = input.request.method ?? 'unknown';
    const spanName = this.getSpanName(method);
    const statusCode = input.status === 'ok' ? SpanStatusCode.OK : SpanStatusCode.ERROR;

    const span = this.tracer.startSpan(spanName, {
      startTime: input.startedAt,
      attributes: this.buildAttributes(input),
    });

    span.setAttribute('duration.ms', input.durationMs);
    span.setStatus({
      code: statusCode,
      message: input.status === 'error' ? 'error' : undefined,
    });

    if (input.status === 'error' && input.response.error) {
      span.addEvent('error', {
        'error.message': input.response.error.message,
        'error.code': input.response.error.code,
      });
    }

    const toolName = (input.request.params as { name?: string } | undefined)?.name;
    if (method === 'tools/call' && toolName) {
      this.metrics.record(toolName, statusCode, input.durationMs);
    }

    this.log.debug(`${spanName} [${input.status}] ${input.durationMs}ms`, {
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
    });

    span.end(input.endedAt);
  }

  private getSpanName(method: string): string {
    return NAMES[method] ?? `mcp.${method}`;
  }

  private buildAttributes(input: SpanInput): Attributes {
    const attrs: Attributes = {
      'rpc.method': input.request.method,
      'rpc.system': 'mcp',
    };

    const params = input.request.params as Record<string, unknown> | undefined;
    const result = input.response.result as Record<string, unknown> | undefined;

    if (input.request.method === 'tools/call' && params?.name) {
      attrs['tool.name'] = String(params.name);
      attrs['tool.args'] = JSON.stringify(params.arguments);
    }

    if (result) {
      attrs['response.result'] = JSON.stringify(result);
    }

    if (input.response.error) {
      attrs['error.message'] = input.response.error.message;
      attrs['error.code'] = input.response.error.code;
    }

    return attrs;
  }

  getMetrics() {
    return this.metrics.getAll();
  }
}
