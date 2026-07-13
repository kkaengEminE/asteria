import type { MetricCounter } from './MetricCounter.ts';
import type { MetricEvent } from './MetricEvent.ts';

export interface MetricDurationSnapshot {
  name: string;
  count: number;
  totalMs: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
  tags?: Record<string, string>;
}

export interface MetricFailureSnapshot {
  name: string;
  count: number;
  lastFailureReason?: string;
  tags?: Record<string, string>;
}

export interface MetricSnapshot {
  generatedAt: string;
  counters: MetricCounter[];
  durations: MetricDurationSnapshot[];
  failures: MetricFailureSnapshot[];
  events: MetricEvent[];
}
