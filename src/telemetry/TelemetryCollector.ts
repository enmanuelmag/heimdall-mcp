import { SpanStatusCode, trace } from '@opentelemetry/api';

import { createHash } from '@/core/hash';
import { pkg } from '@/core/package-data';

import { LogEmitter } from './LogEmitter';
import { MetricsRecorder } from './MetricsRecorder';

import type { InterceptorContext } from '@/interceptor/Interceptor';
import type { BodyMode, SpanInput } from '@/types';
import type { Attributes } from '@opentelemetry/api';

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

  async record(input: SpanInput, context: InterceptorContext): Promise<void> {
    const method = input.request.method ?? 'unknown';
    const spanName = this.getSpanName(method);
    const statusCode = input.status === 'ok' ? SpanStatusCode.OK : SpanStatusCode.ERROR;

    const span = this.tracer.startSpan(spanName, {
      startTime: input.startedAt,
      attributes: this.buildAttributes(input, context),
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

  private buildAttributes(
    input: SpanInput,
    context: InterceptorContext
  ): Attributes {
    const attrs: Attributes = {
      'mcp.rpc.system': 'mcp',
      'mcp.request.id': String(input.request.id),
      'mcp.jsonrpc.method': input.request.method,
      'mcp.transport': context.transport,
      'mcp.status': input.status,
    };

    if (context.serverInfo.name) {
      attrs['mcp.server.name'] = context.serverInfo.name;
    }
    if (context.serverInfo.version) {
      attrs['mcp.server.version'] = context.serverInfo.version;
    }
    if (context.turnId) {
      attrs['gen_ai.turn.id'] = context.turnId;
    }
    if (context.agentRunId) {
      attrs['gen_ai.agent.run.id'] = context.agentRunId;
    }
    if (context.conversationId) {
      attrs['gen_ai.conversation.id'] = context.conversationId;
    }

    const proxyToServer = context.metadata['latency.proxy_to_server_ms'];
    if (typeof proxyToServer === 'number') {
      attrs['mcp.latency.proxy_to_server_ms'] = proxyToServer;
      attrs['mcp.latency.proxy_overhead_ms'] = input.durationMs - proxyToServer;
    }

    const params = input.request.params as Record<string, unknown> | undefined;
    const result = input.response.result as Record<string, unknown> | undefined;

    if (input.request.method === 'tools/call' && params?.name) {
      attrs['mcp.tool.name'] = String(params.name);
      Object.assign(attrs, this.serialize('args', params.arguments, context.bodyMode));
    }

    if (result) {
      Object.assign(attrs, this.serialize('response.result', result, context.bodyMode));
    }

    if (input.response.error) {
      attrs['mcp.error.message'] = input.response.error.message;
      attrs['mcp.error.code'] = input.response.error.code;
    }

    return attrs;
  }

  private serialize(
    field: 'args' | 'response.result',
    data: unknown,
    mode: BodyMode
  ): Record<string, unknown> {
    const serialized = JSON.stringify(data);
    if (mode === 'full') {
      return {
        [`mcp.${field}_mode`]: 'full',
        [`mcp.tool.${field}`]: serialized,
        [`mcp.tool.${field}_size`]: serialized.length,
        redaction_profile: 'profile_v1',
      };
    }
    if (mode === 'hash') {
      return {
        [`mcp.${field}_mode`]: 'hash',
        [`mcp.tool.${field}`]: `sha256:${createHash(serialized)}`,
        [`mcp.tool.${field}_size`]: serialized.length,
        redaction_profile: 'profile_v1',
      };
    }
    return {
      [`mcp.${field}_mode`]: 'redacted',
      [`mcp.tool.${field}`]: '[redacted]',
      [`mcp.tool.${field}_size`]: serialized.length,
      redaction_profile: 'profile_v1',
    };
  }

  getMetrics() {
    return this.metrics.getAll();
  }
}
