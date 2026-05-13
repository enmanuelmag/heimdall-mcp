import pc from 'picocolors';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export class LogEmitter {
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.emit('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.emit('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.emit('error', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.emit('debug', message, meta);
  }

  private emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.enabled) return;
    const ts = new Date().toISOString();
    const prefix = {
      info: pc.blue('[info]'),
      warn: pc.yellow('[warn]'),
      error: pc.red('[error]'),
      debug: pc.gray('[debug]'),
    }[level];
    const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
    process.stderr.write(`${ts} ${prefix} ${message}${metaStr}\n`);
  }
}
