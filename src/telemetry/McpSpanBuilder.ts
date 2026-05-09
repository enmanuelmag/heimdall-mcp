import { randomBytes } from 'node:crypto'

import type { JsonRpcMessage, McpSpan, SpanStatus } from '@/types'

export interface SpanInput {
  traceId: string
  spanId: string
  request: JsonRpcMessage
  response: JsonRpcMessage
  status: SpanStatus
  startedAt: Date
  endedAt: Date
  durationMs: number
}

const METHOD_TO_SPAN_NAME: Record<string, string> = {
  initialize:       'mcp.initialize',
  'tools/list':     'mcp.tools.list',
  'tools/call':     'mcp.tool.call',
  'resources/read': 'mcp.resource.read',
  'resources/list': 'mcp.resources.list',
  'prompts/get':    'mcp.prompt.get',
  'prompts/list':   'mcp.prompts.list',
  shutdown:         'mcp.shutdown',
}

export class McpSpanBuilder {
  build(input: SpanInput): McpSpan {
    const method = input.request.method ?? 'unknown'
    const spanName = METHOD_TO_SPAN_NAME[method] ?? `mcp.${method}`
    const params = input.request.params as Record<string, unknown> | undefined
    const result = input.response.result as Record<string, unknown> | undefined

    const attributes = this.buildAttributes(method, params, result, input)
    const events = this.buildEvents(method, params, result)

    return {
      id: `${input.traceId}-${input.spanId}`,
      traceId: input.traceId,
      spanId: input.spanId,
      name: spanName,
      status: input.status,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMs: input.durationMs,
      attributes,
      events,
    }
  }

  private buildAttributes(
    method: string,
    params: Record<string, unknown> | undefined,
    result: Record<string, unknown> | undefined,
    input: SpanInput
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      'gen_ai.operation.name': method,
      'mcp.duration_ms': input.durationMs,
    }

    if (method === 'tools/call') {
      const name = (params as { name?: string } | undefined)?.name
      base['gen_ai.tool.name'] = name
      base['gen_ai.tool.call.id'] = randomBytes(8).toString('hex')
    }

    if (method === 'tools/list') {
      const tools = (result as { tools?: unknown[] } | undefined)?.tools
      base['mcp.tools_count'] = Array.isArray(tools) ? tools.length : 0
    }

    if (method === 'resources/read') {
      base['url.full'] = (params as { uri?: string } | undefined)?.uri
    }

    if (method === 'prompts/get') {
      base['mcp.prompt_name'] = (params as { name?: string } | undefined)?.name
    }

    if (method === 'initialize') {
      const p = params as { clientInfo?: { version?: string }; capabilities?: unknown } | undefined
      const r = result as { serverInfo?: { version?: string }; capabilities?: unknown } | undefined
      base['mcp.client_version'] = p?.clientInfo?.version
      base['mcp.server_version'] = r?.serverInfo?.version
      base['mcp.client_capabilities'] = JSON.stringify(p?.capabilities ?? {})
      base['mcp.server_capabilities'] = JSON.stringify(r?.capabilities ?? {})
    }

    return base
  }

  private buildEvents(
    method: string,
    params: Record<string, unknown> | undefined,
    result: Record<string, unknown> | undefined
  ) {
    const events = []

    if (method === 'tools/call') {
      events.push({ name: 'tool.input', timestamp: new Date(), attributes: { body: JSON.stringify(params) } })
      if (result) events.push({ name: 'tool.output', timestamp: new Date(), attributes: { body: JSON.stringify(result) } })
    }

    if (method === 'tools/list' && result) {
      events.push({ name: 'tools.list', timestamp: new Date(), attributes: { tools: JSON.stringify((result as { tools?: unknown }).tools ?? []) } })
    }

    if (method === 'prompts/get' && result) {
      events.push({ name: 'prompt.rendered', timestamp: new Date(), attributes: { body: JSON.stringify(result) } })
    }

    return events
  }
}
