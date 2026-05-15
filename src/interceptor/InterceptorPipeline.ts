import { randomBytes } from 'node:crypto';

import type { Interceptor, InterceptorContext } from './Interceptor';
import type { BodyMode, JsonRpcMessage, ServerInfo, TransportType } from '@/types';

export class InterceptorPipeline {
  private interceptors: Interceptor[] = [];

  use(interceptor: Interceptor): this {
    this.interceptors.push(interceptor);
    return this;
  }

  async run(
    request: JsonRpcMessage,
    bodyMode: BodyMode,
    transport: TransportType,
    serverInfo: ServerInfo
  ): Promise<JsonRpcMessage> {
    const meta = (request.params as { _meta?: Record<string, unknown> })?._meta;

    const context: InterceptorContext = {
      startedAt: new Date(),
      traceId: randomBytes(16).toString('hex'),
      spanId: randomBytes(8).toString('hex'),
      bodyMode,
      transport,
      metadata: {},
      conversationId: meta?.conversationId ? String(meta.conversationId) : undefined,
      turnId: meta?.turnId ? String(meta.turnId) : undefined,
      agentRunId: meta?.agentRunId ? String(meta.agentRunId) : undefined,
      serverInfo,
    };

    let index = 0;
    const next = async (): Promise<JsonRpcMessage> => {
      const interceptor = this.interceptors[index++];
      if (!interceptor) throw new Error('Pipeline ended without ForwardInterceptor');
      return interceptor.intercept(request, context, next);
    };

    return next();
  }
}
