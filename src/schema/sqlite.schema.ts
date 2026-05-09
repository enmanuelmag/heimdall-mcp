import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const spans = sqliteTable('mcp_spans', {
  id:          text('id').primaryKey(),
  traceId:     text('trace_id').notNull(),
  spanId:      text('span_id').notNull(),
  parentId:    text('parent_id'),
  name:        text('name').notNull(),
  status:      text('status').notNull(),
  startedAt:   text('started_at').notNull(),
  endedAt:     text('ended_at').notNull(),
  durationMs:  integer('duration_ms').notNull(),
  attributes:  text('attributes', { mode: 'json' }),
  events:      text('events', { mode: 'json' }),
})

export const metrics = sqliteTable('mcp_metrics', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  toolName:    text('tool_name').notNull(),
  callCount:   integer('call_count').default(0),
  errorCount:  integer('error_count').default(0),
  avgDuration: real('avg_duration'),
  updatedAt:   text('updated_at').notNull(),
})
