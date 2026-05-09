import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { McpSpanBuilder } from '@/telemetry/McpSpanBuilder'
import type { SpanInput } from '@/telemetry/McpSpanBuilder'
import type { JsonRpcMessage } from '@/types'

function makeInput(method: string, params?: unknown, result?: unknown): SpanInput {
  const now = new Date()
  return {
    traceId:    'trace01',
    spanId:     'span01',
    request:    { jsonrpc: '2.0', id: 1, method, params } as JsonRpcMessage,
    response:   { jsonrpc: '2.0', id: 1, result }        as JsonRpcMessage,
    status:     'ok',
    startedAt:  now,
    endedAt:    new Date(now.getTime() + 100),
    durationMs: 100,
  }
}

describe('McpSpanBuilder', () => {
  const builder = new McpSpanBuilder()

  test('builds correct span name for tools/call', () => {
    const span = builder.build(makeInput('tools/call', { name: 'read_file' }))
    assert.equal(span.name, 'mcp.tool.call')
  })

  test('builds correct span name for tools/list', () => {
    const span = builder.build(makeInput('tools/list', undefined, { tools: [] }))
    assert.equal(span.name, 'mcp.tools.list')
  })

  test('builds correct span name for initialize', () => {
    const span = builder.build(makeInput('initialize'))
    assert.equal(span.name, 'mcp.initialize')
  })

  test('builds mcp.{method} for unknown methods', () => {
    const span = builder.build(makeInput('custom/method'))
    assert.equal(span.name, 'mcp.custom/method')
  })

  test('tools/call sets gen_ai.tool.name attribute', () => {
    const span = builder.build(makeInput('tools/call', { name: 'write_file' }))
    assert.equal(span.attributes?.['gen_ai.tool.name'], 'write_file')
  })

  test('tools/call produces tool.input and tool.output events', () => {
    const span = builder.build(makeInput('tools/call', { name: 'read_file', path: '/tmp' }, { content: 'hello' }))
    const names = span.events?.map((e) => e.name) ?? []
    assert.ok(names.includes('tool.input'))
    assert.ok(names.includes('tool.output'))
  })

  test('tools/list sets mcp.tools_count from result', () => {
    const span = builder.build(makeInput('tools/list', undefined, { tools: ['a', 'b', 'c'] }))
    assert.equal(span.attributes?.['mcp.tools_count'], 3)
  })

  test('resources/read sets url.full attribute', () => {
    const span = builder.build(makeInput('resources/read', { uri: 'file:///tmp/foo.txt' }))
    assert.equal(span.attributes?.['url.full'], 'file:///tmp/foo.txt')
  })

  test('prompts/get sets mcp.prompt_name attribute', () => {
    const span = builder.build(makeInput('prompts/get', { name: 'summarize' }))
    assert.equal(span.attributes?.['mcp.prompt_name'], 'summarize')
  })

  test('initialize captures client and server versions', () => {
    const span = builder.build(makeInput(
      'initialize',
      { clientInfo: { version: '1.0.0' }, capabilities: {} },
      { serverInfo: { version: '2.0.0' }, capabilities: {} },
    ))
    assert.equal(span.attributes?.['mcp.client_version'], '1.0.0')
    assert.equal(span.attributes?.['mcp.server_version'], '2.0.0')
  })

  test('span id is composed of traceId and spanId', () => {
    const span = builder.build(makeInput('tools/call', { name: 'x' }))
    assert.equal(span.id, 'trace01-span01')
    assert.equal(span.traceId, 'trace01')
    assert.equal(span.spanId, 'span01')
  })

  test('error status is preserved', () => {
    const input = { ...makeInput('tools/call', { name: 'broken' }), status: 'error' as const }
    const span = builder.build(input)
    assert.equal(span.status, 'error')
  })

  test('durationMs is set correctly', () => {
    const span = builder.build(makeInput('tools/call', { name: 'x' }))
    assert.equal(span.durationMs, 100)
  })
})
