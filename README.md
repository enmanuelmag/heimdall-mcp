# @cardor/heimdall-mcp

Transparent proxy for any MCP server. Intercepts all JSON-RPC messages, measures latency, and stores traces in a configurable database — without touching the original server.

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
mcp_spans
  id           TEXT  PRIMARY KEY   → "{trace_id}-{span_id}"
  trace_id     TEXT  NOT NULL
  span_id      TEXT  NOT NULL
  parent_id    TEXT
  name         TEXT  NOT NULL      → "mcp.tool.call", "mcp.initialize", etc.
  status       TEXT  NOT NULL      → "ok" | "error"
  started_at   TEXT  NOT NULL      → ISO 8601
  ended_at     TEXT  NOT NULL
  duration_ms  INT   NOT NULL
  attributes   JSON               → tool_name, client_version, etc.
  events       JSON               → input/output bodies

mcp_metrics
  id           INT   PRIMARY KEY
  tool_name    TEXT  NOT NULL
  call_count   INT
  error_count  INT
  avg_duration REAL
  updated_at   TEXT
```

---

### PostgreSQL

```
postgres://user:pass@localhost:5432/my_db
postgresql://user:pass@localhost:5432/my_db
```

Driver: [`postgres`](https://github.com/porsager/postgres) — pure JS, no node-gyp.

Same schema as SQLite but with native Postgres types (`TIMESTAMP`, `INTEGER`, `JSON`).

---

### MySQL

```
mysql://user:pass@localhost:3306/my_db
```

Driver: [`mysql2`](https://github.com/sidorares/node-mysql2).

Same schema adapted to MySQL types (`FLOAT`, `INT`, `JSON`, `TIMESTAMP`).

---

## What gets recorded

Every JSON-RPC message produces a span in the `mcp_spans` table. Attributes vary by method:

| MCP method       | Span name             | Key attributes                                              | Events                        |
|------------------|-----------------------|-------------------------------------------------------------|-------------------------------|
| `initialize`     | `mcp.initialize`      | `mcp.client_version`, `mcp.server_version`, capabilities   | —                             |
| `tools/list`     | `mcp.tools.list`      | `mcp.tools_count`, `mcp.duration_ms`                       | tools list as JSON            |
| `tools/call`     | `mcp.tool.call`       | `gen_ai.tool.name`, `gen_ai.tool.call.id`, duration        | `tool.input` + `tool.output`  |
| `resources/read` | `mcp.resource.read`   | `url.full`, `mcp.duration_ms`                              | —                             |
| `resources/list` | `mcp.resources.list`  | `mcp.duration_ms`                                          | —                             |
| `prompts/get`    | `mcp.prompt.get`      | `mcp.prompt_name`, `mcp.duration_ms`                       | rendered prompt body          |
| `prompts/list`   | `mcp.prompts.list`    | `mcp.duration_ms`                                          | —                             |
| `shutdown`       | `mcp.shutdown`        | `mcp.duration_ms`                                          | —                             |
| any other        | `mcp.{method}`        | `gen_ai.operation.name`, `mcp.duration_ms`                 | —                             |

Attributes use the `gen_ai.*` prefix following the [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) for generative AI.

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
  metadata: Record<string, unknown>
}
```

Calling `next()` passes control to the next interceptor in the chain. `ForwardInterceptor` is always last — it makes the actual call to the real server.

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

  --otlp <url>          Export spans to an OTLP HTTP endpoint (e.g. Jaeger)
                          Additive — spans are also saved to the store
                          Example: http://localhost:4318/v1/traces

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

### Policy & Permission System

A per-MCP permission system, loaded at startup via `--policy <path>`.

#### Phase 1 — `--policy` flag + YAML config parsing *(next)*

New CLI flag: `heimdall-mcp --policy ./heimdall-policy.yml -- node server.js`

The proxy reads and parses the YAML file on startup. Base config structure:

```yaml
# heimdall-policy.yml
policy:
  default: allow   # fallback when no explicit rule matches

  deny:
    - tools: ["delete_file", "write_file", "execute_command"]

  allow:
    - tools: ["read_file", "search", "list_directory"]
```

`deny` takes priority over `allow` (deny-wins).

#### Phase 2 — Tool allow/deny enforcement *(planned)*

- Blocking logic in the interceptor using the lists from the config
- If a tool is in `deny` → heimdall returns a JSON-RPC error without forwarding to the real server
- Blocked calls are logged with reason
- Top-level `deny` + `allow` as the first interface (no per-server granularity yet)

#### Phase 3 — Action-type filtering *(planned)*

Filter by action category instead of exact tool name: `read` / `write` / `execute`. heimdall infers the type from the tool name (keyword heuristic) or MCP metadata.

```yaml
policy:
  deny:
    - actions: [write, execute]
  allow:
    - actions: [read]
```

#### Phase 4 — Per-MCP scoped permissions *(planned)*

Permissions declared individually per MCP server:

```yaml
servers:
  filesystem:
    deny:
      tools: ["write_file", "delete_file"]
      actions: [write]
  github:
    allow:
      tools: ["get_issue", "list_prs"]
      actions: [read]
```

#### Phase 5 — Runtime policy enforcement *(planned)*

Real-time blocking with three configurable modes: `block` | `warn` | `audit`

- `block` — rejects the call with a JSON-RPC error
- `warn` — forwards the call but logs a warning with the trace
- `audit` — records the span with attribute `policy.violation = true`

Violations are emitted as OpenTelemetry events on the span.
