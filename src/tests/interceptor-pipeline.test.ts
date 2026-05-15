import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { InterceptorPipeline } from '@/interceptor/InterceptorPipeline';

import type { Interceptor, InterceptorContext } from '@/interceptor/Interceptor';
import type { JsonRpcMessage } from '@/types';

const request: JsonRpcMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'x' },
};
const fakeResponse: JsonRpcMessage = { jsonrpc: '2.0', id: 1, result: { ok: true } };

function makePassthrough(name: string): Interceptor & { called: boolean } {
  return {
    name,
    called: false,
    async intercept(_req, _ctx, next) {
      this.called = true;
      return next();
    },
  };
}

function makeTerminal(response: JsonRpcMessage): Interceptor {
  return {
    name: 'Terminal',
    async intercept(_req, _ctx, _next) {
      return response;
    },
  };
}

describe('InterceptorPipeline', () => {
  test('runs interceptors in order and returns final response', async () => {
    const order: string[] = [];
    const pipeline = new InterceptorPipeline();

    pipeline.use({
      name: 'First',
      async intercept(_req, _ctx, next) {
        order.push('first-before');
        const res = await next();
        order.push('first-after');
        return res;
      },
    });
    pipeline.use({
      name: 'Second',
      async intercept(_req, _ctx, next) {
        order.push('second-before');
        const res = await next();
        order.push('second-after');
        return res;
      },
    });
    pipeline.use(makeTerminal(fakeResponse));

    await pipeline.run(request, 'redacted', 'stdio', {});
    assert.deepEqual(order, ['first-before', 'second-before', 'second-after', 'first-after']);
  });

  test('passes request unchanged to each interceptor', async () => {
    const seen: JsonRpcMessage[] = [];
    const pipeline = new InterceptorPipeline();

    pipeline.use({
      name: 'Recorder',
      async intercept(req, _ctx, next) {
        seen.push(req);
        return next();
      },
    });
    pipeline.use(makeTerminal(fakeResponse));

    await pipeline.run(request, 'redacted', 'stdio', {});
    assert.equal(seen.length, 1);
    assert.equal(seen[0].method, 'tools/call');
  });

  test('context has traceId, spanId, and startedAt', async () => {
    let captured: InterceptorContext | undefined;
    const pipeline = new InterceptorPipeline();

    pipeline.use({
      name: 'ContextCapture',
      async intercept(_req, ctx, next) {
        captured = ctx;
        return next();
      },
    });
    pipeline.use(makeTerminal(fakeResponse));

    await pipeline.run(request, 'redacted', 'stdio', {});
    assert.ok(captured);
    assert.ok(typeof captured.traceId === 'string' && captured.traceId.length > 0);
    assert.ok(typeof captured.spanId === 'string' && captured.spanId.length > 0);
    assert.ok(captured.startedAt instanceof Date);
  });

  test('terminal interceptor that does not call next() stops the chain', async () => {
    const after = makePassthrough('After');
    const pipeline = new InterceptorPipeline();

    pipeline.use(makeTerminal(fakeResponse));
    pipeline.use(after);

    const result = await pipeline.run(request, 'redacted', 'stdio', {});
    assert.equal(after.called, false);
    assert.deepEqual(result, fakeResponse);
  });

  test('throws if pipeline has no terminal and next() is called past last interceptor', async () => {
    const pipeline = new InterceptorPipeline();
    pipeline.use(makePassthrough('Pass'));

    await assert.rejects(() => pipeline.run(request, 'redacted', 'stdio', {}), /Pipeline ended without ForwardInterceptor/);
  });

  test('each run gets an independent traceId', async () => {
    const traceIds: string[] = [];
    const pipeline = new InterceptorPipeline();

    pipeline.use({
      name: 'TraceCapture',
      async intercept(_req, ctx, next) {
        traceIds.push(ctx.traceId);
        return next();
      },
    });
    pipeline.use(makeTerminal(fakeResponse));

    await pipeline.run(request, 'redacted', 'stdio', {});
    await pipeline.run(request, 'redacted', 'stdio', {});
    assert.equal(traceIds.length, 2);
    assert.notEqual(traceIds[0], traceIds[1]);
  });
});
