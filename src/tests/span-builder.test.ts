import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DatabaseSpanProcessor } from '@/telemetry/DatabaseSpanProcessor';

import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

function makeReadableSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  return {
    name: 'mcp.tool.call',
    kind: 2,
    attributes: {
      'gen_ai.tool.name': 'read_file',
    },
    startTime: [12, 345],
    endTime: [13, 456],
    status: { code: 1, message: undefined },
    events: [
      {
        name: 'tool.input',
        time: [12, 500],
        attributes: { body: '{}' },
        droppedAttributesCount: 0,
      },
    ],
    links: [],
    resource: {
      attributes: { 'service.name': 'heimdall-mcp' },
    },
    spanContext() {
      return {
        traceId: 'trace01',
        spanId: 'span01',
        traceFlags: 1,
      };
    },
    ended: true,
    duration: [1, 111],
    ...overrides,
  } as ReadableSpan;
}

describe('DatabaseSpanProcessor', () => {
  test('parseSpanToDbFormat converts a readable span into stored span data', () => {
    const span = DatabaseSpanProcessor.parseSpanToDbFormat(makeReadableSpan());

    assert.equal(span.traceId, 'trace01');
    assert.equal(span.spanId, 'span01');
    assert.equal(span.name, 'mcp.tool.call');
    assert.equal(span.status, 1);
    assert.equal(span.startTimeUnixNano, 12000000345);
    assert.equal(span.endTimeUnixNano, 13000000456);
    assert.deepEqual(span.attributes, { 'gen_ai.tool.name': 'read_file' });
    assert.equal(span.events?.[0]?.name, 'tool.input');
    assert.deepEqual(span.resourceAttributes, { 'service.name': 'heimdall-mcp' });
  });

  test('parseSpanToDbFormat preserves error status and messages', () => {
    const span = DatabaseSpanProcessor.parseSpanToDbFormat(
      makeReadableSpan({ status: { code: 2, message: 'boom' } })
    );

    assert.equal(span.status, 2);
    assert.equal(span.statusMessage, 'boom');
  });
});
