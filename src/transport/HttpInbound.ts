import { createServer } from 'node:http';

import type { McpTransport } from './McpTransport';
import type { JsonRpcMessage } from '@/types';

export class HttpInbound implements McpTransport {
  private handler?: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>;
  private server;

  constructor(
    private port: number,
    private host = '0.0.0.0'
  ) {
    this.server = createServer(async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405).end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = Buffer.concat(chunks).toString();

      try {
        const msg = JSON.parse(body) as JsonRpcMessage;
        const response = this.handler
          ? await this.handler(msg)
          : { jsonrpc: '2.0' as const, id: msg.id, result: null };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch {
        res.writeHead(400).end();
      }
    });
  }

  async send(_message: JsonRpcMessage): Promise<void> {
    // HTTP inbound is request/response — responses go through the handler return value
  }

  onMessage(handler: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>): void {
    this.handler = handler;
    this.server.listen(this.port, this.host);
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}
