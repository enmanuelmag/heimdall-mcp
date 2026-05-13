import { createClient } from '@libsql/client';
import { and, between, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

import { spans } from '@/schema/sqlite.schema';

import type { TraceStore } from './TraceStore';
import type { SpanFilters, StoredSpan } from '@/types';

export class SqliteStore implements TraceStore {
  private db;

  constructor(url: string) {
    const client = createClient({ url });
    this.db = drizzle(client);
  }

  async init(): Promise<void> {
    await this.db.run(sql`
      CREATE TABLE IF NOT EXISTS heimdall_spans (
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
        resource_attributes   TEXT,
        created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.db.run(sql`
      CREATE TABLE IF NOT EXISTS heimdall_metrics (
        id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        tool_name   TEXT    NOT NULL,
        call_count  INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        avg_duration INTEGER,
        updated_at  TEXT    NOT NULL
      )
    `);
  }

  async save(storedSpan: StoredSpan): Promise<void> {
    await this.db.insert(spans).values(storedSpan).onConflictDoNothing();
  }

  async query(filters: SpanFilters): Promise<StoredSpan[]> {
    const conditions = [];
    if (filters.traceId) conditions.push(eq(spans.traceId, filters.traceId));
    if (filters.spanId) conditions.push(eq(spans.spanId, filters.spanId));
    if (filters.name) conditions.push(eq(spans.name, filters.name));
    if (filters.status) {
      conditions.push(eq(spans.status, filters.status));
    }
    if (filters.from && filters.to) {
      conditions.push(
        between(spans.startTimeUnixNano, filters.from.getTime() * 1e6, filters.to.getTime() * 1e6)
      );
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
