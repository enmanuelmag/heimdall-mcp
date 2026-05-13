import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { MySqlStore } from '@/store/MySqlStore';
import type { StoredSpan } from '@/types';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';

describe('MySqlStore', { timeout: 120_000 }, () => {
  let container: StartedTestContainer;
  let store: MySqlStore;
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
    container = await new GenericContainer('mysql:8')
      .withEnvironment({
        MYSQL_ROOT_PASSWORD: 'test',
        MYSQL_DATABASE: 'test',
      })
      .withExposedPorts(3306)
      .withHealthCheck({
        test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost', '-u', 'root', '-ptest'],
        interval: 1_000,
        timeout: 3_000,
        retries: 30,
        startPeriod: 10_000,
      })
      .withWaitStrategy(Wait.forHealthCheck())
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(3306);
    store = new MySqlStore(`mysql://root:test@${host}:${port}/test`);
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
    const traceId = 'mysql-basic';
    await store.saveSpan(makeSpan(traceId));
    const results = await store.query({ traceId });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'mcp.tool.call');
    assert.equal(results[0].status, 1);
  });

  test('saveSpan() preserves attributes and events', async () => {
    const traceId = 'mysql-attrs';
    await store.saveSpan(makeSpan(traceId));
    const [result] = await store.query({ traceId });
    assert.deepEqual(result.attributes, { 'gen_ai.tool.name': 'read_file' });
    assert.equal(result.events?.length, 1);
    assert.equal(result.events?.[0].name, 'tool.input');
  });

  test('saveSpan() on duplicate spanId throws a duplicate key error', async () => {
    const traceId = 'mysql-dup';
    const span = makeSpan(traceId);
    await store.saveSpan(span);
    await assert.rejects(
      () => store.saveSpan(span),
      (err: unknown) => {
        // Drizzle wraps the MySQL error; duplicate info is on err.cause
        const cause = (err as { cause?: { message?: string } }).cause;
        const msg = cause?.message ?? (err instanceof Error ? err.message : '');
        assert.match(msg, /duplicate entry/i);
        return true;
      }
    );
  });

  test('query() filters by status', async () => {
    const traceId = 'mysql-status';
    await store.saveSpan(makeSpan(traceId, { status: 1 }));
    await store.saveSpan(makeSpan(traceId, { status: 2 }));
    const errors = await store.query({ traceId, status: 2 });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].status, 2);
  });

  test('query() filters by name', async () => {
    const traceId = 'mysql-name';
    await store.saveSpan(makeSpan(traceId, { name: 'mcp.tool.call' }));
    await store.saveSpan(makeSpan(traceId, { name: 'mcp.tools.list' }));
    const results = await store.query({ traceId, name: 'mcp.tools.list' });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'mcp.tools.list');
  });

  test('query() filters by spanId', async () => {
    const traceId = 'mysql-spanid';
    const spanA = makeSpan(traceId);
    const spanB = makeSpan(traceId);
    await store.saveSpan(spanA);
    await store.saveSpan(spanB);
    const results = await store.query({ traceId, spanId: spanB.spanId });
    assert.equal(results.length, 1);
    assert.equal(results[0].spanId, spanB.spanId);
  });

  test('query() respects limit', async () => {
    const traceId = 'mysql-limit';
    for (let i = 0; i < 5; i++) {
      await store.saveSpan(makeSpan(traceId));
    }
    const results = await store.query({ traceId, limit: 2 });
    assert.equal(results.length, 2);
  });

  test('query() returns empty array when no matches', async () => {
    const results = await store.query({ traceId: 'mysql-nonexistent' });
    assert.equal(results.length, 0);
  });

  test('query() filters by date range (from/to)', async () => {
    const traceId = 'mysql-range';
    await store.saveSpan(makeSpan(traceId, { startTimeUnixNano: 1_000_000 }));
    await store.saveSpan(makeSpan(traceId, { startTimeUnixNano: 5_000_000 }));
    const results = await store.query({ traceId, from: new Date(0), to: new Date(2) });
    assert.equal(results.length, 1);
    assert.equal(results[0].startTimeUnixNano, 1_000_000);
  });

  test('saveSpan() preserves kind field', async () => {
    const traceId = 'mysql-kind';
    await store.saveSpan(makeSpan(traceId, { kind: 3 }));
    const [result] = await store.query({ traceId });
    assert.equal(result.kind, 3);
  });

  test('saveSpan() preserves links', async () => {
    const traceId = 'mysql-links';
    const links = [{ traceId: 'trace-link', spanId: 'span-link' }];
    await store.saveSpan(makeSpan(traceId, { links }));
    const [result] = await store.query({ traceId });
    assert.deepEqual(result.links, links);
  });

  test('saveSpan() preserves resourceAttributes', async () => {
    const traceId = 'mysql-resource';
    const resourceAttributes = { 'service.name': 'my-svc', 'service.version': '1.0' };
    await store.saveSpan(makeSpan(traceId, { resourceAttributes }));
    const [result] = await store.query({ traceId });
    assert.deepEqual(result.resourceAttributes, resourceAttributes);
  });
});
