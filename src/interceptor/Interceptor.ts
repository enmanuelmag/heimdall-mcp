import type { BodyMode, JsonRpcMessage, ServerInfo, TransportType } from '@/types';

export interface InterceptorContext {
  startedAt: Date;
  traceId: string;
  spanId: string;
  bodyMode: BodyMode;
  transport: TransportType;
  serverInfo: ServerInfo;
  conversationId?: string;
  turnId?: string;
  agentRunId?: string;
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
