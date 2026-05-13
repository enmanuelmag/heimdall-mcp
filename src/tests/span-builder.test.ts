import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DatabaseSpanProcessor } from '@/telemetry/DatabaseSpanProcessor';

import type { TraceStore } from '@/store/TraceStore';
import type { StoredSpan } from '@/types';
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

  test('parseSpanToDbFormat preserves kind field', () => {
    const span = DatabaseSpanProcessor.parseSpanToDbFormat(makeReadableSpan({ kind: 4 }));
    assert.equal(span.kind, 4);
  });

  test('parseSpanToDbFormat preserves links array', () => {
    const links = [{ context: { traceId: 'link-trace', spanId: 'link-span', traceFlags: 1 }, attributes: {} }];
    const span = DatabaseSpanProcessor.parseSpanToDbFormat(makeReadableSpan({ links }));
    assert.deepEqual(span.links, links);
  });

  test('parseSpanToDbFormat sets statusMessage to null when message is undefined', () => {
    const span = DatabaseSpanProcessor.parseSpanToDbFormat(
      makeReadableSpan({ status: { code: 1, message: undefined } })
    );
    assert.equal(span.statusMessage, null);
  });

  test('onEnd() calls store.saveSpan with the parsed span', async () => {
    let captured: StoredSpan | undefined;
    const fakeStore: TraceStore = {
      saveSpan: async (s: StoredSpan) => { captured = s; },
      query: async () => [],
      close: async () => {},
    };

    const processor = new DatabaseSpanProcessor(fakeStore);
    await processor.onEnd(makeReadableSpan());

    assert.ok(captured, 'saveSpan was not called');
    assert.equal(captured.traceId, 'trace01');
    assert.equal(captured.spanId, 'span01');
    assert.equal(captured.name, 'mcp.tool.call');
    assert.equal(captured.status, 1);
  });
});
