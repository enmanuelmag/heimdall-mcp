import * as v from 'valibot';

import { StoreResolver } from '@/store/StoreResolver';
import { initializeTelemetry } from '@/telemetry/TelemetrySetup';
import { TransportFactory } from '@/transport/TransportFactory';

import { McpProxy } from './McpProxy';

import type { InboundConfig, OutboundConfig } from '@/types';

const InboundSchema = v.object({
  transport: v.picklist(['stdio', 'http', 'sse']),
  port: v.optional(v.number()),
  host: v.optional(v.string()),
});

const OutboundSchema = v.object({
  transport: v.picklist(['stdio', 'http', 'sse']),
  url: v.optional(v.string()),
  command: v.optional(v.string()),
  args: v.optional(v.array(v.string())),
});

export class ProxyBuilder {
  private _inbound?: InboundConfig;
  private _outbound?: OutboundConfig;
  private _store?: string;
  private _otlp?: string;
  private debug = false;

  static create(): ProxyBuilder {
    return new ProxyBuilder();
  }

  inbound(config: InboundConfig): this {
    this._inbound = v.parse(InboundSchema, config);
    return this;
  }

  outbound(config: OutboundConfig): this {
    this._outbound = v.parse(OutboundSchema, config);
    return this;
  }

  store(connectionString: string): this {
    this._store = connectionString;
    return this;
  }

  otlp(endpoint: string): this {
    this._otlp = endpoint;
    return this;
  }

  setDebug(enable = false): this {
    this.debug = enable;
    return this;
  }

  async build(): Promise<McpProxy> {
    if (!this._inbound) throw new Error('ProxyBuilder: inbound config is required');
    if (!this._outbound) throw new Error('ProxyBuilder: outbound config is required');
    if (!this._store) throw new Error('ProxyBuilder: store connection string is required');

    const inbound = TransportFactory.createInbound(this._inbound);
    const outbound = TransportFactory.createOutbound(this._outbound);
    const store = await StoreResolver.resolve(this._store);
    const tracerProvider = initializeTelemetry(store, {
      otlpEndpoint: this._otlp,
      debug: this.debug,
    });

    const proxy = new McpProxy(inbound, outbound as ConstructorParameters<typeof McpProxy>[1]);

    process.on('SIGINT', async () => {
      console.log('[heimdall-mcp] Caught SIGINT, shutting down...');
      await proxy.stop();
      await tracerProvider.shutdown();
      process.exit(0);
    });

    return proxy;
  }
}
