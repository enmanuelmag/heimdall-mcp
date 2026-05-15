import type { McpTransport } from './McpTransport';
import type { JsonRpcMessage, TransportType } from '@/types';

export class SseOutbound implements McpTransport {
  transport: TransportType = 'sse';
  private eventSource?: EventSource;
  private pending = new Map<string | number, (msg: JsonRpcMessage) => void>();

  constructor(private url: string) {}

  private ensureConnected() {
    if (this.eventSource) return;
    // Node 22 has built-in EventSource
    this.eventSource = new EventSource(`${this.url}/sse`);
    this.eventSource.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as JsonRpcMessage;
        const id = msg.id;
        if (id != null) {
          const resolve = this.pending.get(id);
          if (resolve) {
            this.pending.delete(id);
            resolve(msg);
          }
        }
      } catch {
        // ignore
      }
    };
  }

  async send(message: JsonRpcMessage): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  }

  async sendAndWait(message: JsonRpcMessage): Promise<JsonRpcMessage> {
    this.ensureConnected();
    return new Promise((resolve, reject) => {
      const id = message.id;
      if (id == null) {
        this.send(message).catch(reject);
        resolve({ jsonrpc: '2.0', id: null });
        return;
      }
      this.pending.set(id, resolve);
      this.send(message).catch((err) => {
        this.pending.delete(id);
        reject(err);
      });
    });
  }

  onMessage(_handler: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>): void {}

  async close(): Promise<void> {
    this.eventSource?.close();
  }
}
