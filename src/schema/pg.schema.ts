import { integer, json, pgTable, real, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const spans = pgTable('heimdall_spans', {
  traceId: text('trace_id').notNull(),
  spanId: text('span_id').notNull().primaryKey(),
  name: text('name').notNull(),
  kind: integer('kind'),
  status: integer('status').notNull(), // 0=UNSET, 1=OK, 2=ERROR
  statusMessage: text('status_message'),
  startTimeUnixNano: integer('start_time_unix_nano').notNull(),
  endTimeUnixNano: integer('end_time_unix_nano').notNull(),
  attributes: json('attributes'),
  events: json('events'),
  links: json('links'),
  resourceAttributes: json('resource_attributes'),
});

export const metrics = pgTable('heimdall_metrics', {
  id: serial('id').primaryKey(),
  toolName: text('tool_name').notNull(),
  callCount: integer('call_count').default(0),
  errorCount: integer('error_count').default(0),
  avgDuration: real('avg_duration'),
  updatedAt: timestamp('updated_at').notNull(),
});
