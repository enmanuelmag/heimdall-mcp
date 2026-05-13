import { and, between, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import { spans } from '@/schema/mysql.schema';

import type { TraceStore } from './TraceStore';
import type { SpanFilters, StoredSpan } from '@/types';

export class MySqlStore implements TraceStore {
  private pool;
  private db;

  constructor(connectionString: string) {
    this.pool = mysql.createPool(connectionString);
    this.db = drizzle(this.pool);
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
        attributes           JSON,
        events               JSON,
        links                JSON,
        resource_attributes  JSON,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS heimdall_metrics (
        id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tool_name    VARCHAR(128)    NOT NULL,
        call_count   INT             DEFAULT 0,
        error_count  INT             DEFAULT 0,
        avg_duration FLOAT,
        updated_at   TIMESTAMP(3)    NOT NULL
      )
    `);
  }

  async save(span: StoredSpan): Promise<void> {
    await this.db.insert(spans).values(span);
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
    await this.pool.end();
  }
}
