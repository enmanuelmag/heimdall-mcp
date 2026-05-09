import { randomBytes } from 'node:crypto'

import type { Interceptor, InterceptorContext } from './Interceptor'
import type { JsonRpcMessage } from '@/types'

export class InterceptorPipeline {
  private interceptors: Interceptor[] = []

  use(interceptor: Interceptor): this {
    this.interceptors.push(interceptor)
    return this
  }

  async run(request: JsonRpcMessage): Promise<JsonRpcMessage> {
    const context: InterceptorContext = {
      startedAt: new Date(),
      traceId: randomBytes(16).toString('hex'),
      spanId: randomBytes(8).toString('hex'),
      metadata: {},
    }

    let index = 0
    const next = async (): Promise<JsonRpcMessage> => {
      const interceptor = this.interceptors[index++]
      if (!interceptor) throw new Error('Pipeline ended without ForwardInterceptor')
      return interceptor.intercept(request, context, next)
    }

    return next()
  }
}
