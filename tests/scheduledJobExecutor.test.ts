import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ApprovalResult } from '../src/domain/approval/index.ts';
import { createPublishingPackage, createTag, type PublishingPackage } from '../src/domain/content/index.ts';
import type { PublishRequest, PublishResult, Publisher } from '../src/domain/publisher/index.ts';
import { AuditLog } from '../src/services/auditLog/index.ts';
import { DryRunPublisher, PublisherService } from '../src/services/publisher/index.ts';
import { PublishingQueue } from '../src/services/publishingQueue/index.ts';
import { ScheduledJobExecutor, SchedulerService } from '../src/services/scheduler/index.ts';

test('scheduled job executor executes due job preview', async () => {
  const setup = await createScheduledSetup();
  const result = await setup.executor.execute({
    jobId: setup.jobId,
    now: '2026-07-10T10:00:00.000Z',
    operation: () => ({ preview: true })
  });
  const queueItem = await setup.queue.getItem(setup.queueItemId);

  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.due, true);
  assert.equal(result.attemptCount, 1);
  assert.equal(queueItem?.status, 'PROCESSING');
});

test('scheduled job executor skips future job', async () => {
  const setup = await createScheduledSetup();
  const result = await setup.executor.execute({
    jobId: setup.jobId,
    now: '2026-07-10T08:00:00.000Z',
    operation: () => ({ preview: true })
  });

  assert.equal(result.status, 'SKIPPED');
  assert.equal(result.due, false);
  assert.equal(result.failure?.code, 'job_not_due');
});

test('scheduled job executor skips cancelled job', async () => {
  const setup = await createScheduledSetup();

  await setup.scheduler.cancel(setup.jobId, 'Cancelled before execution.');

  const result = await setup.executor.execute({
    jobId: setup.jobId,
    now: '2026-07-10T10:00:00.000Z',
    operation: () => ({ preview: true })
  });

  assert.equal(result.status, 'SKIPPED');
  assert.equal(result.failure?.code, 'job_cancelled');
});

test('scheduled job executor skips invalid queue status', async () => {
  const setup = await createScheduledSetup();

  await setup.queue.updateStatus(setup.queueItemId, 'PROCESSING');

  const result = await setup.executor.execute({
    jobId: setup.jobId,
    now: '2026-07-10T10:00:00.000Z',
    operation: () => ({ preview: true })
  });

  assert.equal(result.status, 'SKIPPED');
  assert.equal(result.failure?.code, 'invalid_queue_status');
});

test('scheduled job executor prevents duplicate execution', async () => {
  const setup = await createScheduledSetup();

  const first = await setup.executor.execute({
    jobId: setup.jobId,
    now: '2026-07-10T10:00:00.000Z',
    operation: () => ({ preview: true })
  });
  const duplicate = await setup.executor.execute({
    jobId: setup.jobId,
    now: '2026-07-10T10:00:00.000Z',
    operation: () => ({ preview: true })
  });

  assert.equal(first.status, 'SUCCEEDED');
  assert.equal(duplicate.status, 'SKIPPED');
  assert.equal(duplicate.failure?.code, 'duplicate_execution');
});

test('scheduled job executor succeeds after retry', async () => {
  const setup = await createScheduledSetup();
  let calls = 0;

  const result = await setup.executor.execute({
    jobId: setup.jobId,
    now: '2026-07-10T10:00:00.000Z',
    retryPolicy: {
      maxAttempts: 2,
      delayMs: 25,
      retryableReasons: ['temporary_execution_failure']
    },
    operation: () => {
      calls += 1;

      if (calls === 1) {
        const error = new Error('Temporary execution failure.');
        (error as Error & { code: string; retryable: boolean }).code = 'temporary_execution_failure';
        (error as Error & { code: string; retryable: boolean }).retryable = true;
        throw error;
      }

      return { preview: true };
    }
  });

  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.attemptCount, 2);
  assert.equal(result.retryCount, 1);
});

test('scheduled job executor records retry exhaustion failure', async () => {
  const setup = await createScheduledSetup();
  const result = await setup.executor.execute({
    jobId: setup.jobId,
    now: '2026-07-10T10:00:00.000Z',
    retryPolicy: {
      maxAttempts: 2,
      delayMs: 25,
      retryableReasons: ['temporary_execution_failure']
    },
    operation: () => {
      const error = new Error('Temporary execution failure.');
      (error as Error & { code: string; retryable: boolean }).code = 'temporary_execution_failure';
      (error as Error & { code: string; retryable: boolean }).retryable = true;
      throw error;
    }
  });
  const queueItem = await setup.queue.getItem(setup.queueItemId);

  assert.equal(result.status, 'FAILED');
  assert.equal(result.attemptCount, 2);
  assert.equal(result.failure?.code, 'temporary_execution_failure');
  assert.equal(queueItem?.status, 'FAILED');
});

test('scheduled job executor records audit events', async () => {
  const auditLog = new AuditLog();
  const setup = await createScheduledSetup(auditLog);

  await setup.executor.execute({
    jobId: setup.jobId,
    now: '2026-07-10T10:00:00.000Z',
    operation: () => ({ preview: true })
  });

  assert.equal(auditLog.filterByEventType('JOB_EXECUTION_STARTED').length, 1);
  assert.equal(auditLog.filterByEventType('JOB_EXECUTION_SUCCEEDED').length, 1);
});

test('scheduled job executor executes through publisher service', async () => {
  const auditLog = new AuditLog();
  const queue = new PublishingQueue({ auditLog });
  const scheduler = new SchedulerService({ auditLog, queue });
  const executor = new ScheduledJobExecutor({
    auditLog,
    queue,
    scheduler,
    publisherService: new PublisherService({
      auditLog,
      publisher: new DryRunPublisher(),
      publishingEnabled: false
    })
  });
  const queueResult = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-10T00:00:00.000Z'
  });
  const scheduleResult = await scheduler.schedule({
    queueItem: queueResult.item!,
    policy: {
      scheduledFor: '2026-07-10T09:00:00.000Z',
      timezone: 'UTC'
    },
    now: '2026-07-10T00:00:00.000Z'
  });
  const result = await executor.execute<PublishResult>({
    jobId: scheduleResult.job!.id,
    now: '2026-07-10T10:00:00.000Z',
    publishRequest: {
      publishingPackage: queueResult.item!.publishingPackage,
      destination: queueResult.item!.destination,
      mode: 'preview'
    }
  });

  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.value?.status, 'PREVIEW');
  assert.equal(result.value?.publisher, 'dry-run-publisher');
  assert.equal(auditLog.filterByEventType('PUBLISH_STARTED').length, 1);
  assert.equal(auditLog.filterByEventType('PUBLISH_SUCCEEDED').length, 1);
});

test('scheduled job executor does not invoke publisher adapters', async () => {
  const setup = await createScheduledSetup();
  const publisher = new CountingPublisher();

  await setup.executor.execute({
    jobId: setup.jobId,
    now: '2026-07-10T10:00:00.000Z',
    operation: () => ({ preview: true })
  });

  assert.equal(publisher.calls.length, 0);
});

async function createScheduledSetup(auditLog?: AuditLog) {
  const queue = new PublishingQueue({ auditLog });
  const scheduler = new SchedulerService({ auditLog, queue });
  const executor = new ScheduledJobExecutor({ auditLog, queue, scheduler });
  const queueResult = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-10T00:00:00.000Z'
  });
  const scheduleResult = await scheduler.schedule({
    queueItem: queueResult.item!,
    policy: {
      scheduledFor: '2026-07-10T09:00:00.000Z',
      timezone: 'UTC'
    },
    now: '2026-07-10T00:00:00.000Z'
  });

  return {
    queue,
    scheduler,
    executor,
    queueItemId: queueResult.item!.id,
    jobId: scheduleResult.job!.id
  };
}

class CountingPublisher implements Publisher {
  readonly name = 'counting-publisher';
  readonly mode = 'dry-run' as const;
  readonly calls: PublishRequest[] = [];

  async publish(request: PublishRequest): Promise<PublishResult> {
    this.calls.push(request);

    return {
      status: 'PREVIEW',
      publisher: this.name,
      mode: request.mode ?? 'preview',
      destination: request.destination,
      message: 'Publisher should not be called by ScheduledJobExecutor.'
    };
  }
}

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'Scheduled Execution Article',
      summary: 'A concise scheduled execution article summary.',
      body: 'This scheduled execution article is never published during executor foundation tests.',
      slug: 'scheduled-execution-article',
      language: 'en-US',
      createdAt: '2026-07-10T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: [createTag('scheduler'), createTag('execution')]
      }
    },
    summary: {
      text: 'Scheduled execution package summary.'
    },
    seo: {
      metaTitle: 'Scheduled Execution Article',
      metaDescription: 'A dry-run SEO description for scheduled execution.',
      keywords: ['scheduler', 'execution']
    },
    faq: [
      {
        question: 'Does execution publish content?',
        answer: 'No. It only records a provider-neutral execution preview.'
      }
    ],
    imagePrompt: {
      prompt: 'Scheduler execution preview image.'
    },
    productPrompt: {
      prompt: 'Scheduler execution preview products.'
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
