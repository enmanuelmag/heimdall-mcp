import { createInterface } from 'node:readline';

import type { McpTransport } from './McpTransport';
import type { JsonRpcMessage } from '@/types';

export class StdioInbound implements McpTransport {
  private handler?: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>;

  async send(message: JsonRpcMessage): Promise<void> {
    process.stdout.write(JSON.stringify(message) + '\n');
  }

  onMessage(handler: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>): void {
    this.handler = handler;
    const rl = createInterface({ input: process.stdin, terminal: false });

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcMessage;
        if (this.handler) {
          const response = await this.handler(msg);
          await this.send(response);
        }
      } catch {
        // malformed JSON — ignore
      }
    });
  }

  async close(): Promise<void> {
    process.stdin.destroy();
  }
}
