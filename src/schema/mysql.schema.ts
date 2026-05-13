import { sql } from 'drizzle-orm';
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

export const SPAN_RAW_MYSQL = sql`
CREATE TABLE IF NOT EXISTS heimdall_spans (
  trace_id             VARCHAR(64)  NOT NULL,
  span_id              VARCHAR(64)  NOT NULL PRIMARY KEY,
  name                 VARCHAR(512) NOT NULL,
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
`;

export const METRICS_RAW_MYSQL = sql`
  CREATE TABLE IF NOT EXISTS heimdall_metrics (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tool_name    VARCHAR(128)    NOT NULL,
    call_count   INT             DEFAULT 0,
    error_count  INT             DEFAULT 0,
    avg_duration FLOAT,
    updated_at   TIMESTAMP(3)    NOT NULL
  )
`;
