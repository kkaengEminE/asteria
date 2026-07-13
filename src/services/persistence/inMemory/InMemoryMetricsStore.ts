import type {
  MetricCounter,
  MetricDurationSnapshot,
  MetricEvent,
  MetricFailureSnapshot,
  MetricSnapshot
} from '../../../domain/metrics/index.ts';
import type { MetricsSnapshotQuery, MetricsStore } from '../MetricsStore.ts';
import { clone } from './InMemoryRepositoryUtils.ts';

export class InMemoryMetricsStore implements MetricsStore {
  private readonly events: MetricEvent[] = [];

  async incrementCounter(event: MetricEvent): Promise<MetricEvent> {
    return this.record(event);
  }

  async recordDuration(event: MetricEvent): Promise<MetricEvent> {
    return this.record(event);
  }

  async recordFailure(event: MetricEvent): Promise<MetricEvent> {
    return this.record(event);
  }

  async snapshot(query: MetricsSnapshotQuery = {}): Promise<MetricSnapshot> {
    const events = this.filterEvents(query);

    return {
      generatedAt: new Date().toISOString(),
      counters: createCounterSnapshots(events),
      durations: createDurationSnapshots(events),
      failures: createFailureSnapshots(events),
      events: events.map(clone)
    };
  }

  listEvents(): MetricEvent[] {
    return this.events.map(clone);
  }

  private async record(event: MetricEvent): Promise<MetricEvent> {
    this.events.push(clone(event));
    return clone(event);
  }

  private filterEvents(query: MetricsSnapshotQuery): MetricEvent[] {
    return this.events
      .filter((event) => !query.name || event.name === query.name)
      .filter((event) => !query.type || event.type === query.type)
      .filter((event) => !query.recordedAfter || event.recordedAt >= query.recordedAfter)
      .filter((event) => !query.recordedBefore || event.recordedAt <= query.recordedBefore)
      .filter((event) => {
        if (!query.tags) {
          return true;
        }

        return Object.entries(query.tags).every(([key, value]) => event.tags?.[key] === value);
      })
      .map(clone);
  }
}

function createCounterSnapshots(events: MetricEvent[]): MetricCounter[] {
  const grouped = new Map<string, MetricCounter>();

  for (const event of events.filter((candidate) => candidate.type === 'counter')) {
    const key = createMetricKey(event.name, event.tags);
    const existing = grouped.get(key);

    grouped.set(key, {
      name: event.name,
      value: (existing?.value ?? 0) + event.value,
      tags: event.tags
    });
  }

  return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function createDurationSnapshots(events: MetricEvent[]): MetricDurationSnapshot[] {
  const grouped = new Map<string, MetricEvent[]>();

  for (const event of events.filter((candidate) => candidate.type === 'duration')) {
    const key = createMetricKey(event.name, event.tags);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return [...grouped.values()]
    .map((items) => {
      const values = items.map((item) => item.value);
      const totalMs = values.reduce((sum, value) => sum + value, 0);

      return {
        name: items[0].name,
        count: items.length,
        totalMs,
        averageMs: items.length > 0 ? totalMs / items.length : 0,
        minMs: Math.min(...values),
        maxMs: Math.max(...values),
        tags: items[0].tags
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function createFailureSnapshots(events: MetricEvent[]): MetricFailureSnapshot[] {
  const grouped = new Map<string, MetricEvent[]>();

  for (const event of events.filter((candidate) => candidate.type === 'failure')) {
    const key = createMetricKey(event.name, event.tags);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return [...grouped.values()]
    .map((items) => ({
      name: items[0].name,
      count: items.length,
      lastFailureReason: String(items[items.length - 1].metadata?.reason ?? ''),
      tags: items[0].tags
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function createMetricKey(name: string, tags: Record<string, string> | undefined): string {
  return `${name}:${JSON.stringify(tags ?? {})}`;
}
