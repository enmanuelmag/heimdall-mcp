import { and, between, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import { spans } from '@/schema/mysql.schema';

import type { TraceStore } from './TraceStore';
import type { McpSpan, SpanFilters } from '@/types';

export class MySqlStore implements TraceStore {
  private pool;
  private db;

  constructor(connectionString: string) {
    this.pool = mysql.createPool(connectionString);
    this.db = drizzle(this.pool);
  }

  async init(): Promise<void> {
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS mcp_spans (
        id           VARCHAR(64)  NOT NULL PRIMARY KEY,
        trace_id     VARCHAR(32)  NOT NULL,
        span_id      VARCHAR(16)  NOT NULL,
        parent_id    VARCHAR(16),
        name         VARCHAR(128) NOT NULL,
        status       VARCHAR(16)  NOT NULL,
        started_at   TIMESTAMP(3) NOT NULL,
        ended_at     TIMESTAMP(3) NOT NULL,
        duration_ms  INT          NOT NULL,
        attributes   JSON,
        events       JSON
      )
    `);
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS mcp_metrics (
        id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tool_name    VARCHAR(128)    NOT NULL,
        call_count   INT             DEFAULT 0,
        error_count  INT             DEFAULT 0,
        avg_duration FLOAT,
        updated_at   TIMESTAMP(3)    NOT NULL
      )
    `);
  }

  async save(span: McpSpan): Promise<void> {
    await this.db
      .insert(spans)
      .values({
        id: span.id,
        traceId: span.traceId,
        spanId: span.spanId,
        parentId: span.parentId,
        name: span.name,
        status: span.status,
        startedAt: span.startedAt,
        endedAt: span.endedAt,
        durationMs: span.durationMs,
        attributes: span.attributes ?? null,
        events: span.events ?? null,
      })
      .onDuplicateKeyUpdate({ set: { id: span.id } });
  }

  async query(filters: SpanFilters): Promise<McpSpan[]> {
    const conditions = [];
    if (filters.traceId) conditions.push(eq(spans.traceId, filters.traceId));
    if (filters.spanId) conditions.push(eq(spans.spanId, filters.spanId));
    if (filters.name) conditions.push(eq(spans.name, filters.name));
    if (filters.status) conditions.push(eq(spans.status, filters.status));
    if (filters.from && filters.to) {
      conditions.push(between(spans.startedAt, filters.from, filters.to));
    }

    const rows = await this.db
      .select()
      .from(spans)
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(filters.limit ?? 100);

    return rows.map((r) => ({
      id: r.id,
      traceId: r.traceId,
      spanId: r.spanId,
      parentId: r.parentId ?? undefined,
      name: r.name,
      status: r.status as McpSpan['status'],
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      durationMs: r.durationMs,
      attributes: r.attributes as Record<string, unknown> | undefined,
      events: r.events as McpSpan['events'],
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
