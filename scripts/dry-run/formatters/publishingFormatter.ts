import type { DryRunResult } from '../../../src/services/dryRun/index.ts';

export function formatPublishingQueue(result: DryRunResult): string {
  return result.queueResult
    ? [
        `Result: ${result.queueResult.status}`,
        `Queue Item ID: ${result.queueResult.item?.id ?? 'Unavailable'}`,
        `Queue Status: ${result.queueResult.item?.status ?? 'Unavailable'}`,
        `Approval Decision: ${result.queueResult.approvalDecision}`,
        `Destination: ${result.queueResult.item?.destination.name ?? result.publishPreview?.destination.name ?? 'Unavailable'}`,
        `Reason: ${result.queueResult.failure?.reason ?? result.queueResult.message}`
      ].join('\n')
    : 'Unavailable';
}

export function formatScheduler(result: DryRunResult): string {
  return result.schedulerResult
    ? [
        `Result: ${result.schedulerResult.status}`,
        `Job ID: ${result.schedulerResult.job?.id ?? 'Unavailable'}`,
        `Job Status: ${result.schedulerResult.job?.status ?? 'Unavailable'}`,
        `Queue Item ID: ${result.schedulerResult.job?.queueItemId ?? result.queueResult?.item?.id ?? 'Unavailable'}`,
        `Scheduled For: ${result.schedulerResult.job?.scheduledFor ?? 'Unavailable'}`,
        `Scheduled Job Count: ${result.schedulerResult.operationState?.scheduledJobCount ?? 'Unavailable'}`,
        `Active Job Count: ${result.schedulerResult.operationState?.activeJobCount ?? 'Unavailable'}`,
        `Duplicate Detected: ${String(result.schedulerResult.operationState?.duplicateDetected ?? false)}`,
        `Lookup Succeeded: ${formatOptionalBoolean(result.schedulerResult.operationState?.lookupSucceeded)}`,
        `Schedule Retry Attempts: ${result.schedulerResult.operationState?.retryAttemptCount ?? result.schedulerResult.retryCount ?? 0}`,
        `Reason: ${result.schedulerResult.message}`
      ].join('\n')
    : 'Unavailable';
}

function formatOptionalBoolean(value: boolean | undefined): string {
  return value === undefined ? 'Unavailable' : String(value);
}

export function formatExecutionPreview(result: DryRunResult): string {
  return result.executionResult
    ? [
        `Scheduled Job ID: ${result.executionResult.job?.id ?? result.schedulerResult?.job?.id ?? 'Unavailable'}`,
        `Due: ${result.executionResult.due}`,
        `Execution Status: ${result.executionResult.status}`,
        `Attempt Count: ${result.executionResult.attemptCount}`,
        `Retry Count: ${result.executionResult.retryCount}`,
        `Queue Status: ${result.executionResult.queueResult?.item?.status ?? result.queueResult?.item?.status ?? 'Unavailable'}`,
        `Reason: ${result.executionResult.failure?.reason ?? result.executionResult.message}`
      ].join('\n')
    : 'Unavailable';
}

export function formatPublisher(result: DryRunResult): string {
  return result.publisherResult
    ? [
        `Publisher Adapter: ${String(result.publisherResult.metadata?.adapter ?? result.publisherResult.publisher)}`,
        `Publisher Mode: ${result.publisherResult.mode}`,
        `Preview URL: ${result.publisherResult.previewUrl ?? 'Unavailable'}`,
        `Target Site: ${String(result.publisherResult.metadata?.targetSite ?? 'Unavailable')}`,
        `Publishing Enabled: ${String(result.publisherResult.metadata?.publishingEnabled ?? false)}`,
        `Publish Result: ${result.publisherResult.status}`,
        `Publish ID: ${result.publisherResult.publishId ?? 'Unavailable'}`
      ].join('\n')
    : 'Unavailable';
}

export function formatPublishPreview(result: DryRunResult): string {
  return result.publishPreview
    ? `${result.publishPreview.status.toLowerCase()}: ${result.publishPreview.message ?? 'Dry-run preview generated.'}`
    : 'Unavailable';
}
