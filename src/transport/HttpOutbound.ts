import type { McpTransport } from './McpTransport'
import type { JsonRpcMessage } from '@/types'

export class HttpOutbound implements McpTransport {
  constructor(private url: string) {}

  async send(message: JsonRpcMessage): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })
  }

  async sendAndWait(message: JsonRpcMessage): Promise<JsonRpcMessage> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })
    return res.json() as Promise<JsonRpcMessage>
  }

  onMessage(_handler: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>): void {}

  async close(): Promise<void> {}
}
