import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { PostgresStore } from '@/store/PostgresStore';
import type { StoredSpan } from '@/types';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';

// Uses Wait.forHealthCheck() so pings pg_isready before running any test

describe('PostgresStore', { timeout: 120_000 }, () => {
  let container: StartedTestContainer;
  let store: PostgresStore;
  let spanSeq = 0;

  function nextSpanId() {
    return `span-${++spanSeq}`;
  }

  function makeSpan(traceId: string, overrides: Partial<StoredSpan> = {}): StoredSpan {
    return {
      traceId,
      spanId: nextSpanId(),
      name: 'mcp.tool.call',
      status: 1,
      startTimeUnixNano: 1_000_000,
      endTimeUnixNano: 2_000_000,
      attributes: { 'gen_ai.tool.name': 'read_file' },
      events: [
        {
          name: 'tool.input',
          timestamp: new Date('2026-01-01'),
          attributes: { body: '{}' },
        },
      ],
      ...overrides,
    };
  }

  before(async () => {
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_DB: 'test',
      })
      .withExposedPorts(5432)
      .withHealthCheck({
        test: ['CMD-SHELL', 'pg_isready -U test -d test'],
        interval: 1_000,
        timeout: 3_000,
        retries: 20,
        startPeriod: 2_000,
      })
      .withWaitStrategy(Wait.forHealthCheck())
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);
    store = new PostgresStore(`postgres://test:test@${host}:${port}/test`);
    await store.init();
  });

  after(async () => {
    await store.close();
    await container.stop();
  });

  test('init() is idempotent — calling twice does not throw', async () => {
    await assert.doesNotReject(() => store.init());
  });

  test('saveSpan() stores a span and query() retrieves it', async () => {
    const traceId = 'pg-basic';
    await store.saveSpan(makeSpan(traceId));
    const results = await store.query({ traceId });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'mcp.tool.call');
    assert.equal(results[0].status, 1);
  });

  test('saveSpan() preserves attributes and events', async () => {
    const traceId = 'pg-attrs';
    await store.saveSpan(makeSpan(traceId));
    const [result] = await store.query({ traceId });
    assert.deepEqual(result.attributes, { 'gen_ai.tool.name': 'read_file' });
    assert.equal(result.events?.length, 1);
    assert.equal(result.events?.[0].name, 'tool.input');
  });

  test('saveSpan() on duplicate spanId does not throw (onConflictDoNothing)', async () => {
    const traceId = 'pg-dup';
    const span = makeSpan(traceId);
    await store.saveSpan(span);
    await assert.doesNotReject(() => store.saveSpan(span));
    const results = await store.query({ traceId });
    assert.equal(results.length, 1);
  });

  test('query() filters by status', async () => {
    const traceId = 'pg-status';
    await store.saveSpan(makeSpan(traceId, { status: 1 }));
    await store.saveSpan(makeSpan(traceId, { status: 2 }));
    const errors = await store.query({ traceId, status: 2 });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].status, 2);
  });

  test('query() filters by name', async () => {
    const traceId = 'pg-name';
    await store.saveSpan(makeSpan(traceId, { name: 'mcp.tool.call' }));
    await store.saveSpan(makeSpan(traceId, { name: 'mcp.tools.list' }));
    const results = await store.query({ traceId, name: 'mcp.tools.list' });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'mcp.tools.list');
  });

  test('query() filters by spanId', async () => {
    const traceId = 'pg-spanid';
    const spanA = makeSpan(traceId);
    const spanB = makeSpan(traceId);
    await store.saveSpan(spanA);
    await store.saveSpan(spanB);
    const results = await store.query({ traceId, spanId: spanB.spanId });
    assert.equal(results.length, 1);
    assert.equal(results[0].spanId, spanB.spanId);
  });

  test('query() respects limit', async () => {
    const traceId = 'pg-limit';
    for (let i = 0; i < 5; i++) {
      await store.saveSpan(makeSpan(traceId));
    }
    const results = await store.query({ traceId, limit: 2 });
    assert.equal(results.length, 2);
  });

  test('query() returns empty array when no matches', async () => {
    const results = await store.query({ traceId: 'pg-nonexistent' });
    assert.equal(results.length, 0);
  });

  test('query() filters by date range (from/to)', async () => {
    const traceId = 'pg-range';
    await store.saveSpan(makeSpan(traceId, { startTimeUnixNano: 1_000_000 }));
    await store.saveSpan(makeSpan(traceId, { startTimeUnixNano: 5_000_000 }));
    const results = await store.query({ traceId, from: new Date(0), to: new Date(2) });
    assert.equal(results.length, 1);
    assert.equal(results[0].startTimeUnixNano, 1_000_000);
  });

  test('saveSpan() preserves kind field', async () => {
    const traceId = 'pg-kind';
    await store.saveSpan(makeSpan(traceId, { kind: 3 }));
    const [result] = await store.query({ traceId });
    assert.equal(result.kind, 3);
  });

  test('saveSpan() preserves links', async () => {
    const traceId = 'pg-links';
    const links = [{ traceId: 'trace-link', spanId: 'span-link' }];
    await store.saveSpan(makeSpan(traceId, { links }));
    const [result] = await store.query({ traceId });
    assert.deepEqual(result.links, links);
  });

  test('saveSpan() preserves resourceAttributes', async () => {
    const traceId = 'pg-resource';
    const resourceAttributes = { 'service.name': 'my-svc', 'service.version': '1.0' };
    await store.saveSpan(makeSpan(traceId, { resourceAttributes }));
    const [result] = await store.query({ traceId });
    assert.deepEqual(result.resourceAttributes, resourceAttributes);
  });
});
