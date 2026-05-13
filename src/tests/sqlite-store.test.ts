import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { SqliteStore } from '@/store/SqliteStore';

import type { McpSpan } from '@/types';

const TMP = join(import.meta.dirname, '../../.tmp-test');

function makeSpan(overrides: Partial<McpSpan> = {}): McpSpan {
  const now = new Date();
  return {
    id: 'trace01-span01',
    traceId: 'trace01',
    spanId: 'span01',
    name: 'mcp.tool.call',
    status: 'ok',
    startedAt: now,
    endedAt: new Date(now.getTime() + 42),
    durationMs: 42,
    attributes: { 'gen_ai.tool.name': 'read_file' },
    events: [{ name: 'tool.input', timestamp: now, attributes: { body: '{}' } }],
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
    await store.save(span);
    const results = await store.query({ traceId: 'trace01' });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'trace01-span01');
    assert.equal(results[0].name, 'mcp.tool.call');
    assert.equal(results[0].status, 'ok');
    assert.equal(results[0].durationMs, 42);
  });

  test('save() preserves attributes and events', async () => {
    await store.save(makeSpan());
    const [result] = await store.query({ traceId: 'trace01' });
    assert.deepEqual(result.attributes, { 'gen_ai.tool.name': 'read_file' });
    assert.equal(result.events?.length, 1);
    assert.equal(result.events?.[0].name, 'tool.input');
  });

  test('save() on duplicate id does not throw (onConflictDoNothing)', async () => {
    const span = makeSpan();
    await store.save(span);
    await assert.doesNotReject(() => store.save(span));
    const results = await store.query({ traceId: 'trace01' });
    assert.equal(results.length, 1);
  });

  test('query() filters by status', async () => {
    await store.save(makeSpan({ id: 'trace01-span01', spanId: 'span01', status: 'ok' }));
    await store.save(makeSpan({ id: 'trace01-span02', spanId: 'span02', status: 'error' }));
    const errors = await store.query({ traceId: 'trace01', status: 'error' });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].spanId, 'span02');
  });

  test('query() filters by name', async () => {
    await store.save(makeSpan({ id: 'trace01-span01', spanId: 'span01', name: 'mcp.tool.call' }));
    await store.save(makeSpan({ id: 'trace01-span02', spanId: 'span02', name: 'mcp.tools.list' }));
    const results = await store.query({ traceId: 'trace01', name: 'mcp.tools.list' });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'mcp.tools.list');
  });

  test('query() respects limit', async () => {
    for (let i = 0; i < 5; i++) {
      await store.save(makeSpan({ id: `trace01-span0${i}`, spanId: `span0${i}` }));
    }
    const results = await store.query({ traceId: 'trace01', limit: 2 });
    assert.equal(results.length, 2);
  });

  test('query() returns empty array when no matches', async () => {
    const results = await store.query({ traceId: 'nonexistent' });
    assert.equal(results.length, 0);
  });
});
