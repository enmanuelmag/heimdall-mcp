import { sql } from 'drizzle-orm';
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

export const SPAN_RAW_PG = sql`
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
`;

export const METRICS_RAW_PG = sql`
CREATE TABLE IF NOT EXISTS heimdall_metrics (
  id           SERIAL       PRIMARY KEY,
  tool_name    VARCHAR(128) NOT NULL,
  call_count   INTEGER      DEFAULT 0,
  error_count  INTEGER      DEFAULT 0,
  avg_duration REAL,
  updated_at   TIMESTAMP    NOT NULL
)
`;
