import type { McpTransport } from './McpTransport';
import type { JsonRpcMessage, TransportType } from '@/types';

function parseSse(rawText: string): JsonRpcMessage | null {
  // SSE events are separated by blank lines; each event may have multiple lines
  const events = rawText.split(/\n\n+/);
  for (const event of events) {
    let data = '';
    for (const line of event.split('\n')) {
      if (line.startsWith('data: ')) data = line.slice(6).trim();
    }
    if (!data) continue;
    try {
      return JSON.parse(data) as JsonRpcMessage;
    } catch {
      // empty data line or non-JSON — skip
    }
  }
  return null;
}

export class HttpOutbound implements McpTransport {
  transport: TransportType = 'http';
  private sessionId: string | null = null;

  constructor(private url: string) {}

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
    return headers;
  }

  async send(message: JsonRpcMessage): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(message),
    });
  }

  async sendAndWait(message: JsonRpcMessage): Promise<JsonRpcMessage> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(message),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[heimdall-mcp] fetch failed → ${this.url}: ${detail}\n`);
      return {
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: { code: -32603, message: `HTTP fetch failed: ${detail}` },
      };
    }

    const rawText = await res.text();
    const contentType = res.headers.get('content-type') ?? '';

    if (!res.ok) {
      process.stderr.write(
        `[heimdall-mcp] target returned HTTP ${res.status} → ${this.url}\n` +
          `[heimdall-mcp] response body: ${rawText.slice(0, 500)}\n`
      );
      return {
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: { code: -32603, message: `Target HTTP ${res.status}: ${rawText.slice(0, 200)}` },
      };
    }

    // Capture session ID from any response (set once after initialize)
    const sessionId = res.headers.get('mcp-session-id');
    if (sessionId) this.sessionId = sessionId;

    // SSE response (Streamable HTTP MCP transport)
    if (contentType.includes('text/event-stream')) {
      const parsed = parseSse(rawText);
      if (parsed) return parsed;
      process.stderr.write(
        `[heimdall-mcp] SSE response had no parseable data frame: ${rawText.slice(0, 300)}\n`
      );
      return {
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: { code: -32603, message: 'SSE response contained no JSON-RPC data frame' },
      };
    }

    // Plain JSON response
    try {
      return JSON.parse(rawText) as JsonRpcMessage;
    } catch {
      process.stderr.write(`[heimdall-mcp] target returned non-JSON: ${rawText.slice(0, 500)}\n`);
      return {
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: { code: -32603, message: `Target returned non-JSON: ${rawText.slice(0, 200)}` },
      };
    }
  }

  onMessage(_handler: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>): void {}

  async close(): Promise<void> {}
}
