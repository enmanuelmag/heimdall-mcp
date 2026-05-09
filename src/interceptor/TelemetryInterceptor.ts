import type { Interceptor, InterceptorContext } from './Interceptor'
import type { TelemetryCollector } from '@/telemetry/TelemetryCollector'
import type { JsonRpcMessage } from '@/types'

export class TelemetryInterceptor implements Interceptor {
  readonly name = 'TelemetryInterceptor'

  constructor(private collector: TelemetryCollector) {}

  async intercept(
    request: JsonRpcMessage,
    context: InterceptorContext,
    next: () => Promise<JsonRpcMessage>
  ): Promise<JsonRpcMessage> {
    context.startedAt = new Date()

    let response: JsonRpcMessage
    let status: 'ok' | 'error' = 'ok'

    try {
      response = await next()
      if (response.error) status = 'error'
    } catch (err) {
      status = 'error'
      response = {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: String(err) },
      }
    }

    const endedAt = new Date()
    const durationMs = endedAt.getTime() - context.startedAt.getTime()

    await this.collector.record({
      traceId: context.traceId,
      spanId: context.spanId,
      request,
      response,
      status,
      startedAt: context.startedAt,
      endedAt,
      durationMs,
    })

    return response
  }
}
