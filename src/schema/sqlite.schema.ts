import { sql } from 'drizzle-orm/sql/sql';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const spans = sqliteTable('heimdall_spans', {
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

export const metrics = sqliteTable('heimdall_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  toolName: text('tool_name').notNull(),
  callCount: integer('call_count').default(0),
  errorCount: integer('error_count').default(0),
  avgDuration: integer('avg_duration'),
  updatedAt: text('updated_at').notNull(),
});

export const SPAN_RAW_SQLITE = sql`
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
`;

export const METRICS_RAW_SQLITE = sql`
CREATE TABLE IF NOT EXISTS heimdall_metrics (
  id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  tool_name   TEXT    NOT NULL,
  call_count  INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_duration INTEGER,
  updated_at  TEXT    NOT NULL
)
`;
