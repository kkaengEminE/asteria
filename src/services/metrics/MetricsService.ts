import type {
  MetricCounter,
  MetricDurationSnapshot,
  MetricEvent,
  MetricFailureSnapshot,
  MetricSnapshot
} from '../../domain/metrics/index.ts';
import type { MetricsStore } from '../persistence/index.ts';

export interface MetricRecordOptions {
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
  now?: string;
}

export interface MetricsServiceOptions {
  now?: () => string;
  store: MetricsStore;
}

export class MetricsService {
  private readonly events: MetricEvent[] = [];
  private readonly now: () => string;
  private readonly store: MetricsStore;

  constructor(options: MetricsServiceOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.store = options.store;
  }

  incrementCounter(name: string, amount = 1, options: MetricRecordOptions = {}): MetricEvent {
    return this.record({
      name,
      type: 'counter',
      value: amount,
      recordedAt: options.now ?? this.now(),
      tags: normalizeTags(options.tags),
      metadata: options.metadata
    });
  }

  recordDuration(name: string, durationMs: number, options: MetricRecordOptions = {}): MetricEvent {
    return this.record({
      name,
      type: 'duration',
      value: Math.max(0, durationMs),
      recordedAt: options.now ?? this.now(),
      tags: normalizeTags(options.tags),
      metadata: options.metadata
    });
  }

  recordFailure(name: string, reason: string, options: MetricRecordOptions = {}): MetricEvent {
    return this.record({
      name,
      type: 'failure',
      value: 1,
      recordedAt: options.now ?? this.now(),
      tags: normalizeTags(options.tags),
      metadata: {
        ...options.metadata,
        reason
      }
    });
  }

  snapshot(generatedAt = this.now()): MetricSnapshot {
    return {
      generatedAt,
      counters: createCounterSnapshots(this.events),
      durations: createDurationSnapshots(this.events),
      failures: createFailureSnapshots(this.events),
      events: [...this.events]
    };
  }

  listEvents(): MetricEvent[] {
    return [...this.events];
  }

  private record(event: MetricEvent): MetricEvent {
    this.events.push(event);
    if (event.type === 'counter') {
      void this.store.incrementCounter(event);
    } else if (event.type === 'duration') {
      void this.store.recordDuration(event);
    } else {
      void this.store.recordFailure(event);
    }

    return event;
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

function normalizeTags(tags: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!tags) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(tags)
      .filter(([key, value]) => key.trim().length > 0 && value.trim().length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function createMetricKey(name: string, tags: Record<string, string> | undefined): string {
  return `${name}:${JSON.stringify(tags ?? {})}`;
}
