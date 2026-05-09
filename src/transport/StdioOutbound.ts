import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

import type { JsonRpcMessage } from '@/types'
import type { McpTransport } from './McpTransport'

export class StdioOutbound implements McpTransport {
  private proc
  private pending = new Map<string | number, (msg: JsonRpcMessage) => void>()

  constructor(command: string, args: string[] = []) {
    this.proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'inherit'],
    })

    const rl = createInterface({ input: this.proc.stdout!, terminal: false })
    rl.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      try {
        const msg = JSON.parse(trimmed) as JsonRpcMessage
        const id = msg.id
        if (id != null) {
          const resolve = this.pending.get(id)
          if (resolve) {
            this.pending.delete(id)
            resolve(msg)
          }
        }
      } catch {
        // ignore
      }
    })
  }

  async send(message: JsonRpcMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      this.proc.stdin!.write(JSON.stringify(message) + '\n', (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async sendAndWait(message: JsonRpcMessage): Promise<JsonRpcMessage> {
    return new Promise((resolve, reject) => {
      const id = message.id
      if (id == null) {
        this.send(message).catch(reject)
        // notifications have no response — return empty ack
        resolve({ jsonrpc: '2.0', id: null })
        return
      }
      this.pending.set(id, resolve)
      this.send(message).catch((err) => {
        this.pending.delete(id)
        reject(err)
      })
    })
  }

  // McpTransport.onMessage is not used for outbound — responses come via sendAndWait
  onMessage(_handler: (msg: JsonRpcMessage) => Promise<JsonRpcMessage>): void {}

  async close(): Promise<void> {
    this.proc.stdin!.end()
    await new Promise<void>((resolve) => this.proc.on('close', resolve))
  }
}
