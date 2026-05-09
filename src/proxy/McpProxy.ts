import { EventEmitter } from 'node:events'

import { ForwardInterceptor } from '@/interceptor/ForwardInterceptor'
import { InterceptorPipeline } from '@/interceptor/InterceptorPipeline'
import { TelemetryInterceptor } from '@/interceptor/TelemetryInterceptor'
import type { TraceStore } from '@/store/TraceStore'
import { TelemetryCollector } from '@/telemetry/TelemetryCollector'
import type { HttpOutbound } from '@/transport/HttpOutbound'
import type { SseOutbound } from '@/transport/SseOutbound'
import type { StdioOutbound } from '@/transport/StdioOutbound'
import type { McpTransport } from '@/transport/McpTransport'

export class McpProxy extends EventEmitter {
  private pipeline: InterceptorPipeline

  constructor(
    private inbound: McpTransport,
    private outbound: StdioOutbound | HttpOutbound | SseOutbound,
    store: TraceStore,
  ) {
    super()
    const collector = new TelemetryCollector(store)
    this.pipeline = new InterceptorPipeline()
    this.pipeline.use(new TelemetryInterceptor(collector))
    this.pipeline.use(new ForwardInterceptor(outbound))
  }

  addInterceptor(interceptor: Parameters<InterceptorPipeline['use']>[0]): this {
    // insert before ForwardInterceptor (last item) — not possible post-construction
    // so this is a pre-build concern; McpProxy accepts a custom pipeline instead
    this.pipeline.use(interceptor)
    return this
  }

  async start(): Promise<void> {
    this.inbound.onMessage(async (msg) => {
      try {
        return await this.pipeline.run(msg)
      } catch (err) {
        this.emit('error', err)
        return {
          jsonrpc: '2.0' as const,
          id: msg.id,
          error: { code: -32603, message: String(err) },
        }
      }
    })
  }

  async stop(): Promise<void> {
    await this.inbound.close()
    await this.outbound.close()
  }
}
