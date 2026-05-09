import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, test } from 'node:test'

import { ProxyBuilder } from '@/proxy/ProxyBuilder'

const TMP = join(import.meta.dirname, '../../.tmp-test-builder')
const storeUrl = () => `sqlite://${join(TMP, 'test.db')}`

describe('ProxyBuilder', () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }))
  afterEach(() => rmSync(TMP, { recursive: true, force: true }))

  test('throws when inbound is missing', async () => {
    await assert.rejects(
      () =>
        ProxyBuilder.create()
          .outbound({ transport: 'stdio', command: 'echo' })
          .store(storeUrl())
          .build(),
      /inbound config is required/
    )
  })

  test('throws when outbound is missing', async () => {
    await assert.rejects(
      () =>
        ProxyBuilder.create()
          .inbound({ transport: 'stdio' })
          .store(storeUrl())
          .build(),
      /outbound config is required/
    )
  })

  test('throws when store is missing', async () => {
    await assert.rejects(
      () =>
        ProxyBuilder.create()
          .inbound({ transport: 'stdio' })
          .outbound({ transport: 'stdio', command: 'echo' })
          .build(),
      /store connection string is required/
    )
  })

  test('throws when outbound stdio has no command', async () => {
    await assert.rejects(
      () =>
        ProxyBuilder.create()
          .inbound({ transport: 'stdio' })
          .outbound({ transport: 'stdio' })
          .store(storeUrl())
          .build(),
      /command/i
    )
  })

  test('throws when inbound transport is invalid', () => {
    assert.throws(() =>
      ProxyBuilder.create()
        // @ts-expect-error intentional invalid value
        .inbound({ transport: 'grpc' })
    )
  })

  test('builds successfully with valid stdio → stdio config', async () => {
    const proxy = await ProxyBuilder.create()
      .inbound({ transport: 'stdio' })
      .outbound({ transport: 'stdio', command: 'echo', args: ['hello'] })
      .store(storeUrl())
      .build()

    assert.ok(proxy)
    await proxy.stop()
  })
})
