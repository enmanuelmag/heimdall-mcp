import type { JsonRpcMessage, TransportType } from '@/types';

export interface McpTransport {
  transport: TransportType;
  send(message: JsonRpcMessage): Promise<void>;
  onMessage(handler: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>): void;
  close(): Promise<void>;
}
