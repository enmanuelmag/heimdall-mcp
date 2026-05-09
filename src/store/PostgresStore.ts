import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { and, between, eq } from 'drizzle-orm'

import { spans } from '@/schema/pg.schema'
import type { McpSpan, SpanFilters } from '@/types'

import type { TraceStore } from './TraceStore'

export class PostgresStore implements TraceStore {
  private sql
  private db

  constructor(connectionString: string) {
    this.sql = postgres(connectionString)
    this.db = drizzle(this.sql)
  }

  async save(span: McpSpan): Promise<void> {
    await this.db.insert(spans).values({
      id:         span.id,
      traceId:    span.traceId,
      spanId:     span.spanId,
      parentId:   span.parentId,
      name:       span.name,
      status:     span.status,
      startedAt:  span.startedAt,
      endedAt:    span.endedAt,
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
      conditions.push(between(spans.startedAt, filters.from, filters.to))
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
      startedAt:  r.startedAt,
      endedAt:    r.endedAt,
      durationMs: r.durationMs,
      attributes: r.attributes as Record<string, unknown> | undefined,
      events:     r.events as McpSpan['events'],
    }))
  }

  async close(): Promise<void> {
    await this.sql.end()
  }
}
