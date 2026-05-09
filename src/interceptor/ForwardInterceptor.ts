import type { JsonRpcMessage } from '@/types'
import type { HttpOutbound } from '@/transport/HttpOutbound'
import type { SseOutbound } from '@/transport/SseOutbound'
import type { StdioOutbound } from '@/transport/StdioOutbound'

import type { Interceptor, InterceptorContext } from './Interceptor'

type ForwardableOutbound = StdioOutbound | HttpOutbound | SseOutbound

export class ForwardInterceptor implements Interceptor {
  readonly name = 'ForwardInterceptor'

  constructor(private outbound: ForwardableOutbound) {}

  async intercept(
    request: JsonRpcMessage,
    _context: InterceptorContext,
    _next: () => Promise<JsonRpcMessage>
  ): Promise<JsonRpcMessage> {
    return this.outbound.sendAndWait(request)
  }
}
