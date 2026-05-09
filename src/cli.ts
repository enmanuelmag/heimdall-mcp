import { Command } from 'commander'
import pc from 'picocolors'

import { ProxyBuilder } from '@/proxy/ProxyBuilder'

const program = new Command()

program
  .name('heimdall-mcp')
  .description('Transparent MCP proxy with tracing and configurable storage')
  .version('0.1.0')

program
  .command('start', { isDefault: true })
  .description('Start the proxy (default command)')
  .option('--store <url>', 'Storage connection string (sqlite://, postgres://, mysql://)')
  .option('--target <url>', 'Target server URL for http/sse outbound')
  .option('--in <transport>', 'Inbound transport: stdio | http | sse', 'stdio')
  .option('--in-port <port>', 'Port for inbound http/sse', parseInt)
  .option('--out <transport>', 'Outbound transport: stdio | http | sse', 'stdio')
  .option('--out-port <port>', 'Port for outbound http/sse', parseInt)
  .allowUnknownOption(true)
  .action(async (opts, cmd) => {
    const rawArgs = cmd.args

    if (!opts.store) {
      console.error(pc.red('Error: --store is required'))
      process.exit(1)
    }

    const inTransport = opts.in as 'stdio' | 'http' | 'sse'
    const outTransport = opts.out as 'stdio' | 'http' | 'sse'

    // remaining args after '--' are the subprocess command
    const separatorIdx = rawArgs.indexOf('--')
    const subArgs = separatorIdx >= 0 ? rawArgs.slice(separatorIdx + 1) : []
    const [subCommand, ...subCommandArgs] = subArgs

    const builder = ProxyBuilder.create()
      .inbound({ transport: inTransport, port: opts.inPort })
      .store(opts.store)

    if (outTransport === 'stdio') {
      if (!subCommand) {
        console.error(pc.red('Error: stdio outbound requires a command after --'))
        process.exit(1)
      }
      builder.outbound({ transport: 'stdio', command: subCommand, args: subCommandArgs })
    } else {
      if (!opts.target) {
        console.error(pc.red('Error: http/sse outbound requires --target <url>'))
        process.exit(1)
      }
      builder.outbound({ transport: outTransport, url: opts.target })
    }

    const proxy = await builder.build()

    process.on('SIGINT',  () => proxy.stop().then(() => process.exit(0)))
    process.on('SIGTERM', () => proxy.stop().then(() => process.exit(0)))
    proxy.on('error', (err) => console.error(pc.red('[proxy error]'), err))

    await proxy.start()
  })

program.parse()
