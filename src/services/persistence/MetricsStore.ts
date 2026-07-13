import type { MetricEvent, MetricSnapshot } from '../../domain/metrics/index.ts';
import type { PageRequest } from './PersistenceTypes.ts';

export interface MetricsSnapshotQuery extends PageRequest {
  name?: string;
  type?: MetricEvent['type'];
  recordedAfter?: string;
  recordedBefore?: string;
  tags?: Record<string, string>;
}

export interface MetricsStore {
  incrementCounter(event: MetricEvent): Promise<MetricEvent>;
  recordDuration(event: MetricEvent): Promise<MetricEvent>;
  recordFailure(event: MetricEvent): Promise<MetricEvent>;
  snapshot(query?: MetricsSnapshotQuery): Promise<MetricSnapshot>;
}

