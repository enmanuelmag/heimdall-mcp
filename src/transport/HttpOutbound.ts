import type { McpTransport } from './McpTransport'
import type { JsonRpcMessage } from '@/types'

export class HttpOutbound implements McpTransport {
  constructor(private url: string) {}

  async send(message: JsonRpcMessage): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify(message),
    })
  }

  async sendAndWait(message: JsonRpcMessage): Promise<JsonRpcMessage> {
    let res: Response
    try {
      res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(message),
      })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[heimdall-mcp] fetch failed → ${this.url}: ${detail}\n`)
      return {
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: { code: -32603, message: `HTTP fetch failed: ${detail}` },
      }
    }

    const rawText = await res.text()

    if (!res.ok) {
      process.stderr.write(
        `[heimdall-mcp] target returned HTTP ${res.status} → ${this.url}\n` +
        `[heimdall-mcp] response body: ${rawText.slice(0, 500)}\n`
      )
      return {
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: { code: -32603, message: `Target HTTP ${res.status}: ${rawText.slice(0, 200)}` },
      }
    }

    try {
      return JSON.parse(rawText) as JsonRpcMessage
    } catch {
      process.stderr.write(`[heimdall-mcp] target returned non-JSON: ${rawText.slice(0, 500)}\n`)
      return {
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: { code: -32603, message: `Target returned non-JSON: ${rawText.slice(0, 200)}` },
      }
    }
  }

  onMessage(_handler: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>): void {}

  async close(): Promise<void> {}
}
