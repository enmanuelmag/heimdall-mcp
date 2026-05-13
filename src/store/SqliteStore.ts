import { createClient } from '@libsql/client';
import { and, between, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

import { METRICS_RAW_SQLITE, SPAN_RAW_SQLITE, spans } from '@/schema/sqlite.schema';

import type { TraceStore } from './TraceStore';
import type { SpanFilters, StoredSpan } from '@/types';

export class SqliteStore implements TraceStore {
  private db;

  constructor(url: string) {
    const client = createClient({ url });
    this.db = drizzle(client);
  }

  async init(): Promise<void> {
    await this.db.run(SPAN_RAW_SQLITE);
    await this.db.run(METRICS_RAW_SQLITE);
  }

  async saveSpan(storedSpan: StoredSpan): Promise<void> {
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
