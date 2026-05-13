import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { TransportFactory } from '@/transport/TransportFactory';

describe('TransportFactory', () => {
  test('creates a stdio inbound transport', () => {
    const transport = TransportFactory.createInbound({ transport: 'stdio' });
    assert.equal(transport.constructor.name, 'StdioInbound');
  });

  test('throws when outbound stdio has no command', () => {
    assert.throws(
      () =>
        TransportFactory.createOutbound({
          transport: 'stdio',
        }),
      /requires a command/
    );
  });

  test('creates an http outbound transport', () => {
    const transport = TransportFactory.createOutbound({
      transport: 'http',
      url: 'http://localhost:3000',
    });

    assert.equal(transport.constructor.name, 'HttpOutbound');
  });
});
