import { and, between, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { spans } from '@/schema/pg.schema';

import type { TraceStore } from './TraceStore';
import type { SpanFilters, StoredSpan } from '@/types';

export class PostgresStore implements TraceStore {
  private sql;
  private db;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString);
    this.db = drizzle(this.sql);
  }

  async init(): Promise<void> {
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS heimdall_spans (
        trace_id             TEXT    NOT NULL,
        span_id              TEXT    NOT NULL PRIMARY KEY,
        name                 TEXT    NOT NULL,
        kind                 INTEGER,
        status               INTEGER NOT NULL,
        status_message       TEXT,
        start_time_unix_nano BIGINT NOT NULL,
        end_time_unix_nano   BIGINT NOT NULL,
        attributes           JSONB,
        events               JSONB,
        links                JSONB,
        resource_attributes  JSONB,
        created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS heimdall_metrics (
        id           SERIAL       PRIMARY KEY,
        tool_name    VARCHAR(128) NOT NULL,
        call_count   INTEGER      DEFAULT 0,
        error_count  INTEGER      DEFAULT 0,
        avg_duration REAL,
        updated_at   TIMESTAMP    NOT NULL
      )
    `);
  }

  async save(span: StoredSpan): Promise<void> {
    await this.db.insert(spans).values(span).onConflictDoNothing();
  }

  async query(filters: SpanFilters): Promise<StoredSpan[]> {
    const conditions = [];
    if (filters.traceId) conditions.push(eq(spans.traceId, filters.traceId));
    if (filters.spanId) conditions.push(eq(spans.spanId, filters.spanId));
    if (filters.name) conditions.push(eq(spans.name, filters.name));
    if (filters.status) conditions.push(eq(spans.status, filters.status));
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

  async close(): Promise<void> {
    await this.sql.end();
  }
}
