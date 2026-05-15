import type { Interceptor, InterceptorContext } from './Interceptor';
import type { HttpOutbound } from '@/transport/HttpOutbound';
import type { SseOutbound } from '@/transport/SseOutbound';
import type { StdioOutbound } from '@/transport/StdioOutbound';
import type { JsonRpcMessage } from '@/types';

type ForwardableOutbound = StdioOutbound | HttpOutbound | SseOutbound;

export class ForwardInterceptor implements Interceptor {
  readonly name = 'ForwardInterceptor';

  constructor(private outbound: ForwardableOutbound) {}

  async intercept(
    request: JsonRpcMessage,
    context: InterceptorContext,
    _next: () => Promise<JsonRpcMessage>
  ): Promise<JsonRpcMessage> {
    const proxyToServerStart = Date.now();
    const response = await this.outbound.sendAndWait(request);
    context.metadata['latency.proxy_to_server_ms'] = Date.now() - proxyToServerStart;
    return response;
  }
}
