import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { SqliteStore } from '@/store/SqliteStore';

import type { StoredSpan } from '@/types';

const TMP = join(import.meta.dirname, '../../.tmp-test');

function makeSpan(overrides: Partial<StoredSpan> = {}): StoredSpan {
  return {
    traceId: 'trace01',
    spanId: 'span01',
    name: 'mcp.tool.call',
    status: 1,
    startTimeUnixNano: 12_345_678_901,
    endTimeUnixNano: 12_345_678_943,
    attributes: { 'gen_ai.tool.name': 'read_file' },
    events: [
      {
        name: 'tool.input',
        timestamp: new Date('2026-05-13T11:52:04.105Z'),
        attributes: { body: '{}' },
      },
    ],
    ...overrides,
  };
}

describe('SqliteStore', () => {
  let store: SqliteStore;

  beforeEach(async () => {
    mkdirSync(TMP, { recursive: true });
    store = new SqliteStore(`file:${join(TMP, 'test.db')}`);
    await store.init();
  });

  afterEach(async () => {
    await store.close();
    rmSync(TMP, { recursive: true, force: true });
  });

  test('init() is idempotent — calling twice does not throw', async () => {
    await assert.doesNotReject(() => store.init());
  });

  test('save() stores a span and query() retrieves it', async () => {
    const span = makeSpan();
    await store.saveSpan(span);
    const results = await store.query({ traceId: 'trace01' });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'mcp.tool.call');
    assert.equal(results[0].status, 1);
    assert.equal(results[0].startTimeUnixNano, span.startTimeUnixNano);
  });

  test('save() preserves attributes and events', async () => {
    await store.saveSpan(makeSpan());
    const [result] = await store.query({ traceId: 'trace01' });
    assert.deepEqual(result.attributes, { 'gen_ai.tool.name': 'read_file' });
    assert.equal(result.events?.length, 1);
    assert.equal(result.events?.[0].name, 'tool.input');
  });

  test('save() on duplicate id does not throw (onConflictDoNothing)', async () => {
    const span = makeSpan();
    await store.saveSpan(span);
    await assert.doesNotReject(() => store.saveSpan(span));
    const results = await store.query({ traceId: 'trace01' });
    assert.equal(results.length, 1);
  });

  test('query() filters by status', async () => {
    await store.saveSpan(makeSpan({ spanId: 'span01', status: 1 }));
    await store.saveSpan(makeSpan({ spanId: 'span02', status: 2 }));
    const errors = await store.query({ traceId: 'trace01', status: 2 });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].spanId, 'span02');
  });

  test('query() filters by name', async () => {
    await store.saveSpan(makeSpan({ spanId: 'span01', name: 'mcp.tool.call' }));
    await store.saveSpan(makeSpan({ spanId: 'span02', name: 'mcp.tools.list' }));
    const results = await store.query({ traceId: 'trace01', name: 'mcp.tools.list' });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'mcp.tools.list');
  });

  test('query() respects limit', async () => {
    for (let i = 0; i < 5; i++) {
      await store.saveSpan(makeSpan({ spanId: `span0${i}` }));
    }
    const results = await store.query({ traceId: 'trace01', limit: 2 });
    assert.equal(results.length, 2);
  });

  test('query() returns empty array when no matches', async () => {
    const results = await store.query({ traceId: 'nonexistent' });
    assert.equal(results.length, 0);
  });
});
