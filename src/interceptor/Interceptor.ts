import type { JsonRpcMessage } from '@/types';

export interface InterceptorContext {
  startedAt: Date;
  traceId: string;
  spanId: string;
  metadata: Record<string, unknown>;
}

export interface Interceptor {
  name: string;
  intercept(
    request: JsonRpcMessage,
    context: InterceptorContext,
    next: () => Promise<JsonRpcMessage>
  ): Promise<JsonRpcMessage>;
}
