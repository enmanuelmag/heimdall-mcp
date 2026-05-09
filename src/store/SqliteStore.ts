import { createClient } from '@libsql/client'
import { and, between, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'

import { spans } from '@/schema/sqlite.schema'

import type { TraceStore } from './TraceStore'
import type { McpSpan, SpanFilters } from '@/types'

export class SqliteStore implements TraceStore {
  private db

  constructor(url: string) {
    const client = createClient({ url })
    this.db = drizzle(client)
  }

  async init(): Promise<void> {
    await this.db.run(sql`
      CREATE TABLE IF NOT EXISTS mcp_spans (
        id          TEXT    NOT NULL PRIMARY KEY,
        trace_id    TEXT    NOT NULL,
        span_id     TEXT    NOT NULL,
        parent_id   TEXT,
        name        TEXT    NOT NULL,
        status      TEXT    NOT NULL,
        started_at  TEXT    NOT NULL,
        ended_at    TEXT    NOT NULL,
        duration_ms INTEGER NOT NULL,
        attributes  TEXT,
        events      TEXT
      )
    `)
    await this.db.run(sql`
      CREATE TABLE IF NOT EXISTS mcp_metrics (
        id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        tool_name   TEXT    NOT NULL,
        call_count  INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        avg_duration REAL,
        updated_at  TEXT    NOT NULL
      )
    `)
  }

  async save(span: McpSpan): Promise<void> {
    await this.db.insert(spans).values({
      id:         span.id,
      traceId:    span.traceId,
      spanId:     span.spanId,
      parentId:   span.parentId,
      name:       span.name,
      status:     span.status,
      startedAt:  span.startedAt.toISOString(),
      endedAt:    span.endedAt.toISOString(),
      durationMs: span.durationMs,
      attributes: span.attributes ?? null,
      events:     span.events ?? null,
    }).onConflictDoNothing()
  }

  async query(filters: SpanFilters): Promise<McpSpan[]> {
    const conditions = []
    if (filters.traceId) conditions.push(eq(spans.traceId, filters.traceId))
    if (filters.spanId)  conditions.push(eq(spans.spanId, filters.spanId))
    if (filters.name)    conditions.push(eq(spans.name, filters.name))
    if (filters.status)  conditions.push(eq(spans.status, filters.status))
    if (filters.from && filters.to) {
      conditions.push(between(spans.startedAt, filters.from.toISOString(), filters.to.toISOString()))
    }

    const rows = await this.db
      .select()
      .from(spans)
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(filters.limit ?? 100)

    return rows.map((r) => ({
      id:         r.id,
      traceId:    r.traceId,
      spanId:     r.spanId,
      parentId:   r.parentId ?? undefined,
      name:       r.name,
      status:     r.status as McpSpan['status'],
      startedAt:  new Date(r.startedAt),
      endedAt:    new Date(r.endedAt),
      durationMs: r.durationMs,
      attributes: r.attributes as Record<string, unknown> | undefined,
      events:     r.events as McpSpan['events'],
    }))
  }

  async close(): Promise<void> {}
}
