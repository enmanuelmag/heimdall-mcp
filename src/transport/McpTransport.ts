import type { JsonRpcMessage } from '@/types';

export interface McpTransport {
  send(message: JsonRpcMessage): Promise<void>;
  onMessage(handler: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>): void;
  close(): Promise<void>;
}
