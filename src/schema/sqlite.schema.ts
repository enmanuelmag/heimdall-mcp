import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const spans = sqliteTable('spans', {
  traceId: text('trace_id').notNull(),
  spanId: text('span_id').notNull().primaryKey(),
  name: text('name').notNull(),
  kind: integer('kind'),
  status: integer('status').notNull(), // 0=UNSET, 1=OK, 2=ERROR
  statusMessage: text('status_message'),
  startTimeUnixNano: integer('start_time_unix_nano').notNull(),
  endTimeUnixNano: integer('end_time_unix_nano').notNull(),
  attributes: text('attributes', { mode: 'json' }),
  events: text('events', { mode: 'json' }),
  links: text('links', { mode: 'json' }),
  resourceAttributes: text('resource_attributes', { mode: 'json' }),
});

export const metrics = sqliteTable('mcp_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  toolName: text('tool_name').notNull(),
  callCount: integer('call_count').default(0),
  errorCount: integer('error_count').default(0),
  avgDuration: integer('avg_duration'),
  updatedAt: text('updated_at').notNull(),
});
