import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ApprovalResult } from '../src/domain/approval/index.ts';
import { createPublishingPackage, createTag, type PublishingPackage } from '../src/domain/content/index.ts';
import { AuditLog } from '../src/services/auditLog/index.ts';
import { MetricsService } from '../src/services/metrics/index.ts';
import { PublishingQueue } from '../src/services/publishingQueue/index.ts';
import { SchedulerService } from '../src/services/scheduler/index.ts';

test('scheduler creates a scheduled job for approved queue item', async () => {
  const queue = new PublishingQueue();
  const queueResult = await enqueueApproved(queue);
  const scheduler = new SchedulerService({ queue });

  const result = await scheduler.schedule({
    queueItem: queueResult.item!,
    policy: createSchedulePolicy(),
    now: '2026-07-10T00:00:00.000Z'
  });
  const queueItem = await queue.getItem(queueResult.item!.id);

  assert.equal(result.status, 'scheduled');
  assert.equal(result.job?.status, 'SCHEDULED');
  assert.equal(result.job?.queueItemId, queueResult.item?.id);
  assert.equal(queueItem?.status, 'SCHEDULED');
});

test('scheduler cancels scheduled job and queue item', async () => {
  const queue = new PublishingQueue();
  const queueResult = await enqueueApproved(queue);
  const scheduler = new SchedulerService({ queue });
  const scheduled = await scheduler.schedule({
    queueItem: queueResult.item!,
    policy: createSchedulePolicy()
  });

  const cancelled = await scheduler.cancel(scheduled.job!.id, 'Editorial calendar changed.');
  const queueItem = await queue.getItem(queueResult.item!.id);

  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.job?.status, 'CANCELLED');
  assert.equal(queueItem?.status, 'CANCELLED');
  assert.equal(cancelled.queueResult?.status, 'cancelled');
});

test('scheduler reschedules an active scheduled job', async () => {
  const auditLog = new AuditLog();
  const metricsService = new MetricsService();
  const queue = new PublishingQueue({ auditLog, metricsService });
  const queueResult = await enqueueApproved(queue);
  const scheduler = new SchedulerService({ auditLog, queue, metricsService });
  const scheduled = await scheduler.schedule({
    queueItem: queueResult.item!,
    policy: createSchedulePolicy()
  });

  const rescheduled = await scheduler.reschedule({
    id: scheduled.job!.id,
    policy: {
      scheduledFor: '2026-07-11T09:00:00.000Z',
      timezone: 'UTC'
    },
    reason: 'Move to tomorrow.',
    now: '2026-07-10T01:00:00.000Z'
  });

  assert.equal(rescheduled.status, 'rescheduled');
  assert.equal(rescheduled.job?.scheduledFor, '2026-07-11T09:00:00.000Z');
  assert.equal(rescheduled.job?.metadata?.previousScheduledFor, '2026-07-10T09:00:00.000Z');
  assert.equal(auditLog.filterByEventType('JOB_RESCHEDULED').length, 1);
  assert.equal(metricsService.snapshot().counters.some((counter) => counter.name === 'scheduler.rescheduled'), true);
});

test('scheduler prevents duplicate scheduling for same queue item', async () => {
  const queue = new PublishingQueue();
  const queueResult = await enqueueApproved(queue);
  const scheduler = new SchedulerService({ queue });

  const first = await scheduler.schedule({
    queueItem: queueResult.item!,
    policy: createSchedulePolicy()
  });
  const duplicate = await scheduler.schedule({
    queueItem: queueResult.item!,
    policy: createSchedulePolicy()
  });

  assert.equal(first.status, 'scheduled');
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(duplicate.job?.id, first.job?.id);
});

test('scheduler rejects invalid schedule policy without throwing', async () => {
  const queue = new PublishingQueue();
  const queueResult = await enqueueApproved(queue);
  const scheduler = new SchedulerService({ queue });

  const result = await scheduler.schedule({
    queueItem: queueResult.item!,
    policy: {
      scheduledFor: 'not-a-date'
    }
  });

  assert.equal(result.status, 'rejected');
  assert.match(result.message, /valid date/);
});

test('scheduler retry scheduling succeeds after retryable failure', async () => {
  const auditLog = new AuditLog();
  const metricsService = new MetricsService();
  const queue = new PublishingQueue({ auditLog, metricsService });
  const queueResult = await enqueueApproved(queue);
  const scheduler = new SchedulerService({ auditLog, queue, metricsService });

  const result = await scheduler.retrySchedule({
    queueItem: queueResult.item!,
    policy: createSchedulePolicy(),
    failAttempts: 1,
    retryPolicy: {
      maxAttempts: 2,
      delayMs: 1
    }
  });

  assert.equal(result.status, 'retry_scheduled');
  assert.equal(result.retryCount, 1);
  assert.equal(result.operationState?.retryAttemptCount, 2);
  assert.equal(auditLog.filterByEventType('JOB_SCHEDULE_RETRIED').length, 1);
  assert.equal(metricsService.snapshot().counters.some((counter) => counter.name === 'scheduler.retry_scheduled'), true);
});

test('scheduler completed jobs are immutable', async () => {
  const queue = new PublishingQueue();
  const queueResult = await enqueueApproved(queue);
  const scheduler = new SchedulerService({ queue });
  const scheduled = await scheduler.schedule({
    queueItem: queueResult.item!,
    policy: createSchedulePolicy()
  });
  const completed = await scheduler.markCompleted(scheduled.job!.id, '2026-07-10T10:00:00.000Z');

  const rescheduled = await scheduler.reschedule({
    id: scheduled.job!.id,
    policy: {
      scheduledFor: '2026-07-11T09:00:00.000Z'
    }
  });
  const cancelled = await scheduler.cancel(scheduled.job!.id, 'Should not cancel completed job.');

  assert.equal(completed.status, 'completed');
  assert.equal(completed.job?.status, 'COMPLETED');
  assert.equal(rescheduled.status, 'rejected');
  assert.match(rescheduled.message, /COMPLETED/);
  assert.equal(cancelled.status, 'rejected');
  assert.match(cancelled.message, /COMPLETED/);
});

test('scheduler records audit events for schedule and cancellation', async () => {
  const auditLog = new AuditLog();
  const queue = new PublishingQueue({ auditLog });
  const queueResult = await enqueueApproved(queue);
  const scheduler = new SchedulerService({ auditLog, queue });

  const scheduled = await scheduler.schedule({
    queueItem: queueResult.item!,
    policy: createSchedulePolicy()
  });
  await scheduler.cancel(scheduled.job!.id, 'Audit cancellation.');

  assert.equal(auditLog.filterByEventType('JOB_SCHEDULED').length, 1);
  assert.equal(auditLog.filterByEventType('JOB_CANCELLED').length, 1);
});

test('scheduler rejects queue items that are no longer approved', async () => {
  const queue = new PublishingQueue();
  const queueResult = await enqueueApproved(queue);
  const processing = await queue.updateStatus(queueResult.item!.id, 'PROCESSING');
  const scheduler = new SchedulerService({ queue });

  const result = await scheduler.schedule({
    queueItem: processing.item!,
    policy: createSchedulePolicy()
  });

  assert.equal(result.status, 'rejected');
  assert.match(result.message, /requires APPROVED/);
});

function createSchedulePolicy() {
  return {
    scheduledFor: '2026-07-10T09:00:00.000Z',
    timezone: 'UTC'
  };
}

async function enqueueApproved(queue: PublishingQueue) {
  return queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-10T00:00:00.000Z'
  });
}

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'Scheduled Cat Article',
      summary: 'A concise scheduled cat article summary.',
      body: 'This scheduled cat article is never published during scheduler foundation tests.',
      slug: 'scheduled-cat-article',
      language: 'en-US',
      createdAt: '2026-07-10T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: [createTag('cat'), createTag('scheduler')]
      }
    },
    summary: {
      text: 'Scheduled package summary.'
    },
    seo: {
      metaTitle: 'Scheduled Cat Article',
      metaDescription: 'A dry-run SEO description for a scheduled cat article.',
      keywords: ['cat', 'scheduler']
    },
    faq: [
      {
        question: 'Is this scheduled job publishing content?',
        answer: 'No. It only records a provider-neutral schedule preview.'
      }
    ],
    imagePrompt: {
      prompt: 'Cat scheduler preview image.'
    },
    productPrompt: {
      prompt: 'Cat scheduler preview products.'
    }
  });
}

function createApprovalFixture(decision: ApprovalResult['decision']): ApprovalResult {
  return {
    decision,
    status: decision === 'APPROVED' ? 'ready' : 'review_required',
    reasons: [],
    recommendations: [],
    blockingIssues: [],
    nonBlockingIssues: [],
    approvedAt: decision === 'APPROVED' ? '2026-07-10T00:00:00.000Z' : undefined,
    reviewedAt: '2026-07-10T00:00:00.000Z'
  };
}

function createDestination() {
  return {
    type: 'wordpress',
    name: 'WordPress Preview',
    enabled: false,
    dryRunOnly: true
  };
}
