import { HttpInbound } from './HttpInbound';
import { HttpOutbound } from './HttpOutbound';
import { SseInbound } from './SseInbound';
import { SseOutbound } from './SseOutbound';
import { StdioInbound } from './StdioInbound';
import { StdioOutbound } from './StdioOutbound';

import type { McpTransport } from './McpTransport';
import type { InboundConfig, McpTransportOutbound, OutboundConfig } from '@/types';

export class TransportFactory {
  static createInbound(config: InboundConfig): McpTransport {
    switch (config.transport) {
      case 'stdio':
        return new StdioInbound();
      case 'http':
        return new HttpInbound(config.port ?? 3000, config.host);
      case 'sse':
        return new SseInbound(config.port ?? 3000, config.host);
    }
  }

  static createOutbound(config: OutboundConfig): McpTransportOutbound {
    switch (config.transport) {
      case 'stdio':
        if (!config.command) throw new Error('outbound stdio requires a command');
        return new StdioOutbound(config.command, config.args);
      case 'http':
        if (!config.url) throw new Error('outbound http requires a url');
        return new HttpOutbound(config.url);
      case 'sse':
        if (!config.url) throw new Error('outbound sse requires a url');
        return new SseOutbound(config.url);
    }
  }
}
