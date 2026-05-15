import { createServer } from 'node:http';

import type { McpTransport } from './McpTransport';
import type { JsonRpcMessage, TransportType } from '@/types';
import type { ServerResponse } from 'node:http';

export class SseInbound implements McpTransport {
  transport: TransportType = 'sse';
  private handler?: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>;
  private server;
  private clients = new Set<ServerResponse>();

  constructor(
    private port: number,
    private host = '0.0.0.0'
  ) {
    this.server = createServer(async (req, res) => {
      if (req.url === '/sse' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        this.clients.add(res);
        req.on('close', () => this.clients.delete(res));
        return;
      }

      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        try {
          const msg = JSON.parse(Buffer.concat(chunks).toString()) as JsonRpcMessage;
          const response = this.handler
            ? await this.handler(msg)
            : { jsonrpc: '2.0' as const, id: msg.id, result: null };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch {
          res.writeHead(400).end();
        }
        return;
      }

      res.writeHead(404).end();
    });
  }

  async send(message: JsonRpcMessage): Promise<void> {
    const data = `data: ${JSON.stringify(message)}\n\n`;
    for (const client of this.clients) client.write(data);
  }

  onMessage(handler: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>): void {
    this.handler = handler;
    this.server.listen(this.port, this.host);
  }

  async close(): Promise<void> {
    for (const client of this.clients) client.end();
    await new Promise<void>((resolve, reject) =>
      this.server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}
