import { float, int, json, mysqlTable, serial, timestamp, varchar } from 'drizzle-orm/mysql-core';

export const spans = mysqlTable('mcp_spans', {
  id: varchar('id', { length: 64 }).primaryKey(),
  traceId: varchar('trace_id', { length: 32 }).notNull(),
  spanId: varchar('span_id', { length: 16 }).notNull(),
  parentId: varchar('parent_id', { length: 16 }),
  name: varchar('name', { length: 128 }).notNull(),
  status: varchar('status', { length: 16 }).notNull(),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at').notNull(),
  durationMs: int('duration_ms').notNull(),
  attributes: json('attributes'),
  events: json('events'),
});

export const metrics = mysqlTable('mcp_metrics', {
  id: serial('id').primaryKey(),
  toolName: varchar('tool_name', { length: 128 }).notNull(),
  callCount: int('call_count').default(0),
  errorCount: int('error_count').default(0),
  avgDuration: float('avg_duration'),
  updatedAt: timestamp('updated_at').notNull(),
});
