import { createClient } from '@libsql/client';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

import { spans } from '@/schema/sqlite.schema';

import type { TraceStore } from './TraceStore';
import type { SpanFilters, StoredSpan } from '@/types';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

export class SqliteStore implements TraceStore {
  private db;

  constructor(url: string) {
    const client = createClient({ url });
    this.db = drizzle(client);
  }

  async init(): Promise<void> {
    await this.db.run(sql`
      CREATE TABLE IF NOT EXISTS spans (
        trace_id              TEXT NOT NULL,
        span_id               TEXT NOT NULL PRIMARY KEY,
        name                  TEXT NOT NULL,
        kind                  INTEGER,
        status                INTEGER NOT NULL,
        status_message        TEXT,
        start_time_unix_nano  INTEGER NOT NULL,
        end_time_unix_nano    INTEGER NOT NULL,
        attributes            TEXT,
        events                TEXT,
        links                 TEXT,
        resource_attributes  TEXT,
        created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.db.run(sql`
      CREATE TABLE IF NOT EXISTS mcp_metrics (
        id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        tool_name   TEXT    NOT NULL,
        call_count  INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        avg_duration INTEGER,
        updated_at  TEXT    NOT NULL
      )
    `);
  }

  async save(span: ReadableSpan): Promise<void> {
    const spanContext = span.spanContext();

    await this.db
      .insert(spans)
      .values({
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        name: span.name,
        kind: span.kind,
        status: span.status.code,
        statusMessage: span.status.message || null,
        startTimeUnixNano: span.startTime[0] * 1_000_000_000 + span.startTime[1],
        endTimeUnixNano: span.endTime[0] * 1_000_000_000 + span.endTime[1],
        attributes: span.attributes || {},
        events: span.events || [],
        links: span.links || [],
        resourceAttributes: span.resource || {},
      })
      .onConflictDoNothing();
  }

  async query(filters: SpanFilters): Promise<StoredSpan[]> {
    const conditions = [];
    if (filters.traceId) conditions.push(eq(spans.traceId, filters.traceId));
    if (filters.spanId) conditions.push(eq(spans.spanId, filters.spanId));
    if (filters.name) conditions.push(eq(spans.name, filters.name));
    if (filters.status) {
      const statusCode = filters.status === 'ok' ? 1 : filters.status === 'error' ? 2 : 0;
      conditions.push(eq(spans.status, statusCode));
    }

    const rows = (await this.db
      .select()
      .from(spans)
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(filters.limit ?? 100)) as StoredSpan[];

    return rows;
  }

  async close(): Promise<void> {}
}
