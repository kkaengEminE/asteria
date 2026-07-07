import type { AnalyticsEvent, AnalyticsSnapshot } from './types';

export interface AnalyticsProvider {
  readonly name: string;
  track(event: AnalyticsEvent): Promise<void>;
  getSnapshot(source: string, periodStart: string, periodEnd: string): Promise<AnalyticsSnapshot>;
}

