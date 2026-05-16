# @cardor/heimdall-mcp

Transparent proxy for any MCP server. Intercepts all JSON-RPC messages, measures latency, and stores traces in a configurable database — without touching the original server.

Visit the [website](https://stack.cardor.dev/heimdall) to view a full explanation, examples, and other tools!

[![heimdall-mcp MCP server](https://glama.ai/mcp/servers/enmanuelmag/heimdall-mcp/badges/score.svg)](https://glama.ai/mcp/servers/enmanuelmag/heimdall-mcp)

<a href='https://ko-fi.com/S6S31ZBGQK' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

## Table of Contents

- [@cardor/heimdall-mcp](#cardorheimdall-mcp)
  - [Table of Contents](#table-of-contents)
  - [How it works](#how-it-works)
  - [Installation](#installation)
  - [Usage modes](#usage-modes)
    - [Mode 1 — CLI wrapping a subprocess (stdio)](#mode-1--cli-wrapping-a-subprocess-stdio)
    - [Mode 2 — CLI wrapping a remote HTTP server](#mode-2--cli-wrapping-a-remote-http-server)
    - [Mode 3 — CLI wrapping a remote SSE server](#mode-3--cli-wrapping-a-remote-sse-server)
    - [Mode 4 — Library for developers](#mode-4--library-for-developers)
  - [Stores](#stores)
    - [SQLite](#sqlite)
    - [PostgreSQL](#postgresql)
    - [MySQL](#mysql)
  - [What gets recorded](#what-gets-recorded)
  - [Jaeger UI (OTLP)](#jaeger-ui-otlp)
    - [1. Start Jaeger](#1-start-jaeger)
    - [2. Add `--otlp` to your config](#2-add---otlp-to-your-config)
    - [3. Open Jaeger UI](#3-open-jaeger-ui)
  - [Custom interceptors](#custom-interceptors)
  - [CLI reference](#cli-reference)
  - [Roadmap](#roadmap)

---

## How it works

```mermaid
flowchart LR
    A["MCP Client\n(Claude Desktop / OpenCode / Cursor)"]

    subgraph proxy["heimdall-mcp"]
        B["TelemetryInterceptor"]
        C["ForwardInterceptor"]
        D[("SQLite\nPostgres\nMySQL")]
        B --> C
        B -->|"saves span"| D
    end

    S["Real MCP server\n(subprocess / HTTP / SSE)"]

    A -->|"stdio"| B
    C -->|"stdio · http · sse"| S
    S -->|"response"| C
    C -->|"response"| A
```

The proxy always exposes **stdio** to the MCP client and speaks the correct transport to the real server. Every request/response pair is converted into a span with timing, attributes, and the input/output body.

---

## Installation

```bash
npm install -g @cardor/heimdall-mcp
# or as a project dependency
npm install @cardor/heimdall-mcp
```

---

## Usage modes

### Mode 1 — CLI wrapping a subprocess (stdio)

The MCP client thinks it is talking to `heimdall-mcp`. The proxy spawns the real server as a child process and forwards all messages.

**`mcp.json` / Claude Desktop configuration:**

```json
{
  "mcpServers": {
    "my-server": {
      "command": "heimdall-mcp",
      "args": [
        "--store", "sqlite://~/.mcp-traces/traces.db",
        "--", "node", "my-server.js"
      ]
    }
  }
}
```

The `--` separator divides heimdall-mcp flags from the real server command. Everything after it is executed as a subprocess.

**With a globally installed server:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "heimdall-mcp",
      "args": [
        "--store", "sqlite://~/.mcp-traces/traces.db",
        "--", "npx", "@modelcontextprotocol/server-filesystem", "/tmp"
      ]
    }
  }
}
```

**With Postgres instead of SQLite:**

```json
{
  "mcpServers": {
    "my-server": {
      "command": "heimdall-mcp",
      "args": [
        "--store", "postgres://user:pass@localhost:5432/traces",
        "--", "node", "my-server.js"
      ]
    }
  }
}
```

---

### Mode 2 — CLI wrapping a remote HTTP server

When the MCP server is already running and exposes an HTTP endpoint.

```json
{
  "mcpServers": {
    "remote-server": {
      "command": "heimdall-mcp",
      "args": [
        "--store",  "sqlite://~/.mcp-traces/traces.db",
        "--out",    "http",
        "--target", "http://localhost:3001"
      ]
    }
  }
}
```

The proxy exposes **stdio** to the client and forwards each message as an HTTP `POST` to the target URL.

---

### Mode 3 — CLI wrapping a remote SSE server

For servers that use Server-Sent Events.

```json
{
  "mcpServers": {
    "sse-server": {
      "command": "heimdall-mcp",
      "args": [
        "--store",  "postgres://user:pass@host/db",
        "--out",    "sse",
        "--target", "http://remote.example.com"
      ]
    }
  }
}
```

The proxy connects to `{target}/sse` to receive responses and sends requests as `POST` to `{target}`.

---

### Mode 4 — Library for developers

When you have access to the source code and want to integrate the proxy programmatically.

**Minimal setup:**

```ts
import { ProxyBuilder } from '@cardor/heimdall-mcp'

const proxy = await ProxyBuilder.create()
  .inbound({ transport: 'stdio' })
  .outbound({ transport: 'stdio', command: 'node', args: ['my-server.js'] })
  .store('sqlite://./traces.db')
  .build()

await proxy.start()

// clean shutdown
process.on('SIGINT', () => proxy.stop())
```

**stdio → remote HTTP:**

```ts
const proxy = await ProxyBuilder.create()
  .inbound({ transport: 'stdio' })
  .outbound({ transport: 'http', url: 'http://localhost:3001' })
  .store('postgres://user:pass@localhost/traces')
  .build()

await proxy.start()
```

**HTTP inbound (proxy listens on a port):**

```ts
const proxy = await ProxyBuilder.create()
  .inbound({ transport: 'http', port: 8080 })
  .outbound({ transport: 'stdio', command: 'node', args: ['server.js'] })
  .store('mysql://user:pass@localhost/traces')
  .build()

await proxy.start()
```

**With OTLP export and debug logging:**

```ts
const proxy = await ProxyBuilder.create()
  .inbound({ transport: 'stdio' })
  .outbound({ transport: 'stdio', command: 'node', args: ['my-server.js'] })
  .store('sqlite://./traces.db')
  .otlp('http://localhost:4318/v1/traces')   // export to Jaeger / Tempo / Grafana
  .setDebug(true)                             // verbose span logs to stderr
  .build()

await proxy.start()
```

**With a custom interceptor:**

```ts
import type { Interceptor, InterceptorContext, JsonRpcMessage } from '@cardor/heimdall-mcp'

class LogAllInterceptor implements Interceptor {
  name = 'LogAllInterceptor'

  async intercept(
    request: JsonRpcMessage,
    context: InterceptorContext,
    next: () => Promise<JsonRpcMessage>
  ): Promise<JsonRpcMessage> {
    console.log('→', request.method, request.id)
    const response = await next()
    console.log('←', response.id, response.error ? 'ERROR' : 'OK')
    return response
  }
}

const proxy = await ProxyBuilder.create()
  .inbound({ transport: 'stdio' })
  .outbound({ transport: 'stdio', command: 'node', args: ['server.js'] })
  .store('sqlite://./traces.db')
  .build()

proxy.addInterceptor(new LogAllInterceptor())
await proxy.start()
```

---

## Stores

### SQLite

No external server required — ideal for local development.

**Valid connection strings:**

```
sqlite://./traces.db
sqlite://~/.mcp-traces/traces.db
sqlite:///absolute/path/traces.db
```

Driver: [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts) — pure WASM, no native compilation required.

**Schema:**

```
heimdall_spans
  span_id               TEXT     PRIMARY KEY
  trace_id              TEXT     NOT NULL
  name                  TEXT     NOT NULL      → "mcp.tool.call", "mcp.initialize", etc.
  kind                  INTEGER               → OTel SpanKind: 0=INTERNAL, 1=SERVER, 2=CLIENT, 3=PRODUCER, 4=CONSUMER
  status                INTEGER  NOT NULL     → 0=UNSET, 1=OK, 2=ERROR
  status_message        TEXT
  start_time_unix_nano  INTEGER  NOT NULL     → Unix nanoseconds (OTel native)
  end_time_unix_nano    INTEGER  NOT NULL
  attributes            TEXT/JSON             → mcp.jsonrpc.method, mcp.tool.name, mcp.transport, mcp.status, mcp.request.id, mcp.server.name, mcp.latency.*, duration.ms, etc.
  events                TEXT/JSON             → OTel events array (e.g. error events)
  links                 TEXT/JSON             → OTel links array
  resource_attributes   TEXT/JSON             → service.name, service.version, service.namespace (OTel semantic conventions)
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP

heimdall_metrics
  id           INTEGER  PRIMARY KEY AUTOINCREMENT
  tool_name    TEXT     NOT NULL
  call_count   INTEGER  DEFAULT 0
  error_count  INTEGER  DEFAULT 0
  avg_duration INTEGER
  updated_at   TEXT     NOT NULL
```

> **Note:** SQLite uses `INTEGER` for nanosecond timestamps because SQLite has no native `BIGINT` type — the integer affinity handles large values correctly.

---

### PostgreSQL

```
postgres://user:pass@localhost:5432/my_db
postgresql://user:pass@localhost:5432/my_db
```

Driver: [`postgres`](https://github.com/porsager/postgres) — pure JS, no node-gyp.

**Schema differences from SQLite:**
- `start_time_unix_nano` / `end_time_unix_nano` → `BIGINT` (native 64-bit, exact for nanoseconds)
- `attributes` / `events` / `links` / `resource_attributes` → `JSONB` (indexable, queryable)
- `avg_duration` → `REAL`
- `updated_at` → `TIMESTAMP`
- `created_at` → `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`

---

### MySQL

```
mysql://user:pass@localhost:3306/my_db
```

Driver: [`mysql2`](https://github.com/sidorares/node-mysql2).

**Schema differences from SQLite:**
- `span_id` / `trace_id` / `name` → `VARCHAR(64/512)` (explicit lengths)
- `start_time_unix_nano` / `end_time_unix_nano` → `BIGINT` (native 64-bit, exact for nanoseconds)
- `attributes` / `events` / `links` / `resource_attributes` → `JSON`
- `avg_duration` → `FLOAT`
- `id` in metrics → `BIGINT UNSIGNED AUTO_INCREMENT`
- `updated_at` → `TIMESTAMP(3)` (millisecond precision)

---

## What gets recorded

Every JSON-RPC message produces a span in the `heimdall_spans` table. All attributes follow the `mcp.*` namespace for interoperability with other MCP-aware tools.

| MCP method       | Span name            | Key attributes                                                                                           |
|------------------|----------------------|----------------------------------------------------------------------------------------------------------|
| `initialize`     | `mcp.initialize`     | `mcp.jsonrpc.method`, `mcp.transport`, `mcp.request.id`, `mcp.status`, `duration.ms`                    |
| `tools/list`     | `mcp.tools.list`     | + `mcp.server.name`, `mcp.server.version`, `mcp.args_mode`, `mcp.response.result_mode`                  |
| `tools/call`     | `mcp.tool.call`      | + `mcp.tool.name`, `mcp.tool.args`, `mcp.latency.proxy_to_server_ms`, `mcp.latency.proxy_overhead_ms`   |
| `resources/read` | `mcp.resource.read`  | + `mcp.server.name`, `mcp.server.version`                                                                |
| `resources/list` | `mcp.resources.list` | + `mcp.server.name`, `mcp.server.version`                                                                |
| `prompts/get`    | `mcp.prompt.get`     | + `mcp.server.name`, `mcp.server.version`                                                                |
| `prompts/list`   | `mcp.prompts.list`   | + `mcp.server.name`, `mcp.server.version`                                                                |
| `shutdown`       | `mcp.shutdown`       | `mcp.jsonrpc.method`, `mcp.transport`, `mcp.request.id`, `mcp.status`, `duration.ms`                    |
| any other        | `mcp.{method}`       | `mcp.jsonrpc.method`, `mcp.transport`, `mcp.request.id`, `mcp.status`, `duration.ms`                    |

**Common attributes on every span:**

| Attribute | Description |
|---|---|
| `mcp.rpc.system` | Always `"mcp"` |
| `mcp.jsonrpc.method` | The JSON-RPC method name |
| `mcp.request.id` | JSON-RPC request ID — lets you join request/response deterministically |
| `mcp.transport` | `stdio`, `http`, or `sse` |
| `mcp.status` | `ok` or `error` |
| `mcp.server.name` | Name of the real MCP server (captured from `initialize` response) |
| `mcp.server.version` | Version of the real MCP server (captured from `initialize` response) |
| `duration.ms` | Total round-trip latency in milliseconds |

**Latency breakdown (on `tools/call`):**

| Attribute | Description |
|---|---|
| `mcp.latency.proxy_to_server_ms` | Time the real server took to respond |
| `mcp.latency.proxy_overhead_ms` | Overhead introduced by the proxy itself |

**Body capture modes:**

Body capture is controlled by `--body-mode` (CLI) or `.setBodyMode()` (library). Default is `redacted`.

| Mode | `mcp.tool.args` / `mcp.tool.response.result` | Also stored |
|---|---|---|
| `redacted` (default) | `[redacted]` | `_size`, `redaction_profile` |
| `hash` | `sha256:<hex>` | `_size`, `redaction_profile` |
| `full` | raw JSON | `_size`, `redaction_profile` |

> Use `full` only for local development — raw bodies in shared OTLP backends can leak secrets.

**Agent correlation (optional):**

If the MCP client sends a `_meta` object inside `params`, heimdall-mcp will automatically extract and record these attributes:

| `_meta` field | Span attribute |
|---|---|
| `conversationId` | `gen_ai.conversation.id` |
| `turnId` | `gen_ai.turn.id` |
| `agentRunId` | `gen_ai.agent.run.id` |

As a fallback, the env vars `MCP_CONVERSATION_ID`, `MCP_TURN_ID`, and `MCP_AGENT_RUN_ID` are used if set.

On error, every span also gets `mcp.error.message` and `mcp.error.code` attributes plus an `error` OTel event attached to the span.

Every span's `resource_attributes` column contains OTel resource metadata:
- `service.name` — `@cardor/heimdall-mcp`
- `service.version` — package version
- `service.namespace` — `mcp-proxy`

The schema follows the [OpenTelemetry data model](https://opentelemetry.io/docs/concepts/signals/traces/) natively:
- Timestamps stored as **Unix nanoseconds** (`BIGINT` in Postgres/MySQL, `INTEGER` in SQLite)
- `kind` is an integer **SpanKind** (0=INTERNAL, 1=SERVER, 2=CLIENT, 3=PRODUCER, 4=CONSUMER)
- `status` is an integer **SpanStatusCode** (0=UNSET, 1=OK, 2=ERROR)
- JSON columns map directly to OTLP attribute bags

This means rows can be consumed directly by any OTel-compatible tool without transformation.

---

## Jaeger UI (OTLP)

heimdall-mcp can export every span to a Jaeger instance in real time via OTLP HTTP, so you can visualize traces without querying the database directly.

![Jaeger UI showing heimdall-mcp traces](assets/jaeger.png)

### 1. Start Jaeger

```bash
docker run -d \
  --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

### 2. Add `--otlp` to your config

```json
{
  "mcpServers": {
    "my-server": {
      "command": "heimdall-mcp",
      "args": [
        "--store",  "sqlite://~/.mcp-traces/traces.db",
        "--otlp",   "http://localhost:4318/v1/traces",
        "--", "node", "my-server.js"
      ]
    }
  }
}
```

For the HTTP/SSE variant (e.g. the setup used during development of this project):

```json
{
  "mcpServers": {
    "my-server": {
      "command": "sh", "-c",
      "args": [
        "heimdall-mcp --store postgresql://user:pass@localhost:5432/db --out http --target http://localhost:3000/mcp --otlp http://localhost:4318/v1/traces"
      ]
    }
  }
}
```

### 3. Open Jaeger UI

```
http://localhost:16686
```

Select service **heimdall-mcp** and click **Find Traces**. Each MCP method (`mcp.tool.call`, `mcp.initialize`, `mcp.tools.list`, …) appears as a separate trace with full attributes and input/output event bodies.

**Dark mode** — append `?uiConfig={"theme":"dark"}` to the URL, or mount a config file:

```bash
echo '{"uiConfig":{"theme":"dark"}}' > jaeger-ui.json

docker rm -f jaeger && docker run -d \
  --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  -v $(pwd)/jaeger-ui.json:/etc/jaeger/ui-config.json \
  -e JAEGER_UI_CONFIG_FILE=/etc/jaeger/ui-config.json \
  jaegertracing/all-in-one:latest
```

> The `--otlp` flag is additive — spans are saved to the database **and** exported to Jaeger at the same time.

---

## Custom interceptors

The `Interceptor` interface is public. You can add your own logic into the pipeline before the telemetry interceptor:

```ts
interface Interceptor {
  name: string
  intercept(
    request: JsonRpcMessage,
    context: InterceptorContext,
    next: () => Promise<JsonRpcMessage>
  ): Promise<JsonRpcMessage>
}

interface InterceptorContext {
  startedAt: Date
  traceId: string
  spanId: string
  bodyMode: 'redacted' | 'hash' | 'full'
  transport: 'stdio' | 'http' | 'sse'
  serverInfo: { name?: string; version?: string }  // populated after initialize
  conversationId?: string                           // from _meta or env var
  turnId?: string
  agentRunId?: string
  metadata: Record<string, unknown>                 // shared bag between interceptors
}
```

Calling `next()` passes control to the next interceptor in the chain. `ForwardInterceptor` is always last — it makes the actual call to the real server and records `latency.proxy_to_server_ms` in `context.metadata` for the telemetry interceptor to read.

You can use `context.metadata` to pass data between your interceptor and others in the same pipeline run.

---

## CLI reference

```
heimdall-mcp [options] [-- command [args...]]

Options:
  --store <url>         Store connection string (required)
                          sqlite://./traces.db
                          postgres://user:pass@host/db
                          mysql://user:pass@host/db

  --out <transport>     Transport to the real server (default: stdio)
                          stdio | http | sse

  --target <url>        Server URL when --out is http or sse

  --in <transport>      Inbound transport (default: stdio)
                          stdio | http | sse

  --in-port <port>      Port for --in http or --in sse

  --otlp <url>          Export spans to an OTLP HTTP endpoint (e.g. Jaeger, Tempo)
                          Additive — spans are also saved to the store
                          Example: http://localhost:4318/v1/traces

  --body-mode <mode>    Body capture mode for tool args and responses (default: redacted)
                          redacted  → stores [redacted] + size (safe for production)
                          hash      → stores sha256:<hex> + size (safe for production)
                          full      → stores raw JSON (local/dev only — may leak secrets)

  --out-port <port>     Port for outbound http or sse transport

  --debug               Write verbose logs to stderr (prints span names + trace IDs to stderr)

  -V, --version         Print version
  -h, --help            Print this help

  --                    Separates proxy flags from the subprocess command
                        (required when --out is stdio)

Examples:
  # stdio proxy → subprocess
  heimdall-mcp --store sqlite://./t.db -- node server.js

  # stdio proxy → remote HTTP server
  heimdall-mcp --store sqlite://./t.db --out http --target http://localhost:3001

  # stdio proxy → remote SSE server with Postgres
  heimdall-mcp --store postgres://user:pass@host/db --out sse --target http://remote.com

  # with OTLP export to Jaeger
  heimdall-mcp --store sqlite://./t.db --otlp http://localhost:4318/v1/traces -- node server.js
```

---

## Roadmap

| Phase | Feature | Status |
|---|---|---|
| 1 | `--policy` flag + YAML config parsing (`default`, `deny`, `allow` lists by tool name) | 🔜 Next |
| 2 | Enforce allow/deny in the interceptor — blocked calls return a JSON-RPC error and are logged | 📋 Planned |
| 3 | Filter by action type (`read` / `write` / `execute`) inferred from tool name or MCP metadata | 📋 Planned |
| 4 | Per-MCP scoped permissions — separate `deny`/`allow` blocks per server in the config | 📋 Planned |
| 5 | Runtime enforcement modes: `block` (reject), `warn` (log + forward), `audit` (span with `policy.violation = true`) | 📋 Planned |
