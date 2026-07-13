import type { MetricType } from './MetricType.ts';

export interface MetricEvent {
  name: string;
  type: MetricType;
  value: number;
  recordedAt: string;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}
