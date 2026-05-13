import { Command } from 'commander';
import pc from 'picocolors';

import { pkg } from '@/core/package-data';
import { ProxyBuilder } from '@/proxy/ProxyBuilder';

function log(msg: string, ...args: unknown[]) {
  process.stderr.write(`[heimdall-mcp] ${msg} ${args.map((a) => JSON.stringify(a)).join(' ')}\n`);
}

const program = new Command();

program
  .name(pkg.name)
  .description('Transparent MCP proxy with tracing and configurable storage')
  .version(pkg.version);

program
  .command('start', { isDefault: true })
  .description('Start the proxy (default command)')
  .option('--store <url>', 'Storage connection string (sqlite://, postgres://, mysql://)')
  .option('--target <url>', 'Target server URL for http/sse outbound')
  .option('--in <transport>', 'Inbound transport: stdio | http | sse', 'stdio')
  .option('--in-port <port>', 'Port for inbound http/sse', parseInt)
  .option('--out <transport>', 'Outbound transport: stdio | http | sse', 'stdio')
  .option('--out-port <port>', 'Port for outbound http/sse', parseInt)
  .option(
    '--otlp <url>',
    'OTLP HTTP endpoint for Jaeger/Tempo (e.g. http://localhost:4318/v1/traces)'
  )
  .option('--debug', 'Write verbose logs to stderr')
  .allowUnknownOption(true)
  .action(async (opts) => {
    const debug = Boolean(opts.debug);

    // Commander may strip '--' from cmd.args — parse process.argv directly to be safe
    const dashDashIdx = process.argv.indexOf('--');
    const subArgs = dashDashIdx >= 0 ? process.argv.slice(dashDashIdx + 1) : [];
    const [subCommand, ...subCommandArgs] = subArgs;

    if (debug) {
      log('starting with config', {
        store: opts.store,
        inTransport: opts.in,
        outTransport: opts.out,
        target: opts.target ?? null,
        subCommand: subCommand ?? null,
        subCommandArgs,
      });
    }

    if (!opts.store) {
      process.stderr.write(pc.red('Error: --store is required\n'));
      process.exit(1);
    }

    const inTransport = opts.in as 'stdio' | 'http' | 'sse';
    const outTransport = opts.out as 'stdio' | 'http' | 'sse';

    const builder = ProxyBuilder.create()
      .inbound({ transport: inTransport, port: opts.inPort })
      .store(opts.store);

    if (opts.otlp) builder.otlp(opts.otlp);

    if (outTransport === 'stdio') {
      if (!subCommand) {
        process.stderr.write(pc.red('Error: stdio outbound requires a command after --\n'));
        process.stderr.write(`  Received process.argv: ${JSON.stringify(process.argv)}\n`);
        process.exit(1);
      }
      builder.outbound({ transport: 'stdio', command: subCommand, args: subCommandArgs });
    } else {
      if (!opts.target) {
        process.stderr.write(pc.red('Error: http/sse outbound requires --target <url>\n'));
        process.exit(1);
      }
      builder.outbound({ transport: outTransport, url: opts.target });
    }

    let proxy;
    try {
      proxy = await builder.build();
    } catch (err) {
      process.stderr.write(pc.red(`Error building proxy: ${err}\n`));
      if (debug && err instanceof Error) process.stderr.write(err.stack + '\n');
      process.exit(1);
    }

    if (debug) {
      log('proxy built, starting...');
      builder.setDebug(true);
    }

    process.on('SIGINT', () => {
      if (debug) log('SIGINT received, stopping');
      proxy.stop().then(() => process.exit(0));
    });
    process.on('SIGTERM', () => {
      if (debug) log('SIGTERM received, stopping');
      proxy.stop().then(() => process.exit(0));
    });

    process.on('uncaughtException', (err) => {
      process.stderr.write(pc.red(`[heimdall-mcp] uncaught: ${err}\n`));
      if (debug) process.stderr.write(err.stack + '\n');
    });

    proxy.on('error', (err) => {
      process.stderr.write(pc.red(`[heimdall-mcp] proxy error: ${err}\n`));
      if (debug && err instanceof Error) process.stderr.write(err.stack + '\n');
    });

    await proxy.start();
    if (debug) log('proxy running');
  });

program.parse();
