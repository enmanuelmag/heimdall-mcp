import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { StoreResolver } from '@/store/StoreResolver';

import type { StoredSpan } from '@/types';

const TMP = join(import.meta.dirname, '../../.tmp-test-resolver');

describe('StoreResolver', () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  function makeStoredSpan(): StoredSpan {
    return {
      traceId: 'tr',
      spanId: 'sp',
      name: 'mcp.initialize',
      status: 1,
      startTimeUnixNano: 12_345_678_901,
      endTimeUnixNano: 12_345_678_902,
    };
  }

  test('resolves sqlite:// and returns an initialized store', async () => {
    const store = await StoreResolver.resolve(`sqlite://${join(TMP, 'test.db')}`); // StoreResolver converts to file:
    // If init() ran correctly we can save without error
    await assert.doesNotReject(() => store.saveSpan(makeStoredSpan()));
    await store.close();
  });

  test('throws for unsupported connection string', async () => {
    await assert.rejects(() => StoreResolver.resolve('redis://localhost'), /Unsupported store/);
  });
});
