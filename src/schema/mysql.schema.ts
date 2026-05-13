import { float, int, json, mysqlTable, serial, text, timestamp } from 'drizzle-orm/mysql-core';

export const spans = mysqlTable('heimdall_spans', {
  traceId: text('trace_id').notNull(),
  spanId: text('span_id').notNull().primaryKey(),
  name: text('name').notNull(),
  kind: int('kind'),
  status: int('status').notNull(), // 0=UNSET, 1=OK, 2=ERROR
  statusMessage: text('status_message'),
  startTimeUnixNano: int('start_time_unix_nano').notNull(),
  endTimeUnixNano: int('end_time_unix_nano').notNull(),
  attributes: json('attributes'),
  events: json('events'),
  links: json('links'),
  resourceAttributes: json('resource_attributes'),
});

export const metrics = mysqlTable('heimdall_metrics', {
  id: serial('id').primaryKey(),
  toolName: text('tool_name').notNull(),
  callCount: int('call_count').default(0),
  errorCount: int('error_count').default(0),
  avgDuration: float('avg_duration'),
  updatedAt: timestamp('updated_at').notNull(),
});
