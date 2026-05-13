import { and, between, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { METRICS_RAW_PG, SPAN_RAW_PG, spans } from '@/schema/pg.schema';

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
    await this.db.execute(SPAN_RAW_PG);

    await this.db.execute(METRICS_RAW_PG);
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
