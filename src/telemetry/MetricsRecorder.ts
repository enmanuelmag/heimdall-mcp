import type { SpanStatus } from '@/types'

export interface ToolMetrics {
  callCount: number
  errorCount: number
  totalDurationMs: number
}

export class MetricsRecorder {
  private metrics = new Map<string, ToolMetrics>()

  record(toolName: string, status: SpanStatus, durationMs: number): void {
    const existing = this.metrics.get(toolName) ?? { callCount: 0, errorCount: 0, totalDurationMs: 0 }
    existing.callCount++
    if (status === 'error') existing.errorCount++
    existing.totalDurationMs += durationMs
    this.metrics.set(toolName, existing)
  }

  getAll(): Map<string, ToolMetrics & { avgDurationMs: number }> {
    const result = new Map<string, ToolMetrics & { avgDurationMs: number }>()
    for (const [name, m] of this.metrics) {
      result.set(name, {
        ...m,
        avgDurationMs: m.callCount > 0 ? m.totalDurationMs / m.callCount : 0,
      })
    }
    return result
  }
}
