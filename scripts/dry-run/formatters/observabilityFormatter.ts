import type { DryRunResult } from '../../../src/services/dryRun/index.ts';

export function formatMetricsSummary(result: DryRunResult): string {
  const snapshot = result.metricsSnapshot;

  if (!snapshot) {
    return 'Unavailable';
  }

  const counters = snapshot.counters.length > 0
    ? snapshot.counters.map((counter) => `${counter.name}=${counter.value}`).join(', ')
    : 'None';
  const durations = snapshot.durations.length > 0
    ? snapshot.durations
        .map((duration) =>
          `${duration.name}: count=${duration.count}, avg=${Math.round(duration.averageMs)}ms, total=${Math.round(duration.totalMs)}ms`
        )
        .join('\n')
    : 'None';
  const failures = snapshot.failures.length > 0
    ? snapshot.failures
        .map((failure) => `${failure.name}: count=${failure.count}, last=${failure.lastFailureReason ?? 'Unavailable'}`)
        .join('\n')
    : 'None';

  return [
    `Generated At: ${snapshot.generatedAt}`,
    `Counters: ${counters}`,
    'Durations:',
    durations,
    'Failures:',
    failures
  ].join('\n');
}

export function formatAuditTimeline(result: DryRunResult): string {
  return result.auditTimeline && result.auditTimeline.length > 0
    ? result.auditTimeline.map((event, index) =>
        [
          `${index + 1}. ${event.type}`,
          `At: ${event.createdAt}`,
          `Actor: ${event.actor.name ?? event.actor.id}`,
          `Entity: ${event.context.entityType ?? 'unknown'}:${event.context.entityId ?? 'unknown'}`,
          `Message: ${event.message}`
        ].join('\n')
      ).join('\n\n')
    : 'Unavailable';
}

export function formatRetryMetadata(result: DryRunResult): string {
  return result.retryMetadata
    ? [
        `Status: ${result.retryMetadata.status}`,
        `Attempt Count: ${result.retryMetadata.attemptCount}`,
        `Retry Count: ${result.retryMetadata.retryCount}`,
        `Policy: maxAttempts=${result.retryMetadata.policy.maxAttempts}, fixedDelayMs=${result.retryMetadata.policy.delayMs}`,
        `History: ${result.retryMetadata.attempts.map((attempt) =>
          `#${attempt.attemptNumber}:${attempt.status}${attempt.reason ? `:${attempt.reason.code}` : ''}`
        ).join(' -> ')}`
      ].join('\n')
    : 'Unavailable';
}
