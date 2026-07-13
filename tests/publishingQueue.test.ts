import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ApprovalResult } from '../src/domain/approval/index.ts';
import { createPublishingPackage, createTag, type PublishingPackage } from '../src/domain/content/index.ts';
import type { PublishRequest, PublishResult, Publisher } from '../src/domain/publisher/index.ts';
import { AuditLog } from '../src/services/auditLog/index.ts';
import { createInMemoryPersistenceComposition } from '../src/services/persistence/index.ts';
import { PublishingQueue } from '../src/services/publishingQueue/index.ts';
import { PublishingWorkflow } from '../src/services/publishing/index.ts';
import { runMagazineDryRun } from '../src/magazines/runtime/index.ts';
import { formatDryRunReport } from '../scripts/dry-run.ts';

test('publishing queue enqueues approved package', async () => {
  const queue = createQueue();
  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-10T00:00:00.000Z'
  });

  assert.equal(result.status, 'queued');
  assert.equal(result.item?.status, 'APPROVED');
  assert.equal(result.item?.destination.name, 'WordPress Preview');
  assert.equal(result.approvalDecision, 'APPROVED');
});

test('publishing queue rejects needs review package', async () => {
  const queue = createQueue();
  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('NEEDS_REVIEW'),
    destination: createDestination()
  });

  assert.equal(result.status, 'rejected');
  assert.equal(result.item, undefined);
  assert.equal(result.approvalDecision, 'NEEDS_REVIEW');
  assert.match(result.message, /requires APPROVED content/);
});

test('publishing queue rejects rejected package', async () => {
  const queue = createQueue();
  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('REJECTED'),
    destination: createDestination()
  });

  assert.equal(result.status, 'rejected');
  assert.equal(result.approvalDecision, 'REJECTED');
});

test('publishing queue supports lookup and listing', async () => {
  const queue = createQueue();
  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination()
  });

  const item = await queue.getItem(result.item?.id ?? '');
  const items = await queue.listItems();

  assert.equal(item?.id, result.item?.id);
  assert.equal(items.length, 1);
});

test('publishing queue updates status', async () => {
  const queue = createQueue();
  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination()
  });

  const updated = await queue.updateStatus(result.item?.id ?? '', 'PROCESSING', '2026-07-10T01:00:00.000Z');

  assert.equal(updated.status, 'updated');
  assert.equal(updated.item?.status, 'PROCESSING');
  assert.equal(updated.item?.updatedAt, '2026-07-10T01:00:00.000Z');
});

test('publishing queue allows valid transitions', async () => {
  const queue = createQueue();
  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination()
  });

  const scheduled = await queue.updateStatus(result.item?.id ?? '', 'SCHEDULED');
  const processing = await queue.updateStatus(result.item?.id ?? '', 'PROCESSING');
  const published = await queue.updateStatus(result.item?.id ?? '', 'PUBLISHED');

  assert.equal(scheduled.status, 'updated');
  assert.equal(processing.status, 'updated');
  assert.equal(published.status, 'updated');
  assert.equal(published.item?.status, 'PUBLISHED');
});

test('publishing queue rejects invalid transitions', async () => {
  const queue = createQueue();
  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination()
  });

  const invalid = await queue.updateStatus(result.item?.id ?? '', 'PUBLISHED');

  assert.equal(invalid.status, 'invalid_transition');
  assert.match(invalid.message, /APPROVED -> PUBLISHED/);
});

test('publishing queue terminal statuses cannot transition', async () => {
  const queue = createQueue();
  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination()
  });

  await queue.updateStatus(result.item?.id ?? '', 'PROCESSING');
  await queue.updateStatus(result.item?.id ?? '', 'PUBLISHED');

  const cancelled = await queue.cancelItem(result.item?.id ?? '', 'Too late.');
  const failed = await queue.recordFailure(result.item?.id ?? '', {
    reason: 'Cannot fail a published item.'
  });

  assert.equal(cancelled.status, 'invalid_transition');
  assert.equal(failed.status, 'invalid_transition');
});

test('publishing queue failed item requires explicit retry transition to pending', async () => {
  const queue = createQueue();
  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination()
  });

  await queue.recordFailure(result.item?.id ?? '', {
    reason: 'Temporary queue failure.',
    retryable: true
  });

  const implicitRetry = await queue.updateStatus(result.item?.id ?? '', 'PENDING');
  const explicitRetry = await queue.updateStatus(result.item?.id ?? '', 'PENDING', undefined, { retried: true });

  assert.equal(implicitRetry.status, 'invalid_transition');
  assert.equal(explicitRetry.status, 'updated');
  assert.equal(explicitRetry.item?.status, 'PENDING');
});

test('publishing queue cancels item', async () => {
  const queue = createQueue();
  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination()
  });

  const cancelled = await queue.cancelItem(result.item?.id ?? '', 'Editorial pause.');

  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.item?.status, 'CANCELLED');
  assert.equal(cancelled.item?.metadata?.cancellationReason, 'Editorial pause.');
});

test('publishing queue records failure', async () => {
  const queue = createQueue();
  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination()
  });

  const failed = await queue.recordFailure(result.item?.id ?? '', {
    reason: 'Preview validation failed.',
    code: 'preview_validation',
    retryable: false
  });

  assert.equal(failed.status, 'failed');
  assert.equal(failed.item?.status, 'FAILED');
  assert.equal(failed.failure?.reason, 'Preview validation failed.');
});

test('publishing queue records audit event on needs review rejection', async () => {
  const { auditLog, queue } = createAuditedQueue();

  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('NEEDS_REVIEW'),
    destination: createDestination()
  });
  const events = auditLog.filterByEventType('QUEUE_REJECTED');

  assert.equal(result.status, 'rejected');
  assert.equal(events.length, 1);
  assert.equal(events[0].metadata?.approvalDecision, 'NEEDS_REVIEW');
});

test('publishing queue records audit event on rejected approval rejection', async () => {
  const { auditLog, queue } = createAuditedQueue();

  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('REJECTED'),
    destination: createDestination()
  });
  const events = auditLog.filterByEventType('QUEUE_REJECTED');

  assert.equal(result.status, 'rejected');
  assert.equal(events.length, 1);
  assert.equal(events[0].metadata?.approvalDecision, 'REJECTED');
});

test('publishing queue records audit event on missing approval rejection', async () => {
  const { auditLog, queue } = createAuditedQueue();

  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    destination: createDestination()
  });
  const events = auditLog.filterByEventType('QUEUE_REJECTED');

  assert.equal(result.status, 'rejected');
  assert.equal(events.length, 1);
  assert.equal(events[0].metadata?.approvalDecision, 'UNKNOWN');
});

test('publishing workflow creates queue item without invoking publisher', async () => {
  const publisher = new CountingPublisher();
  const queue = createQueue();
  const workflow = new PublishingWorkflow({
    publisher,
    queue,
    config: {
      dryRun: true,
      publishingEnabled: false,
      requireApproval: true
    }
  });

  const result = await workflow.execute({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination()
  });

  assert.equal(result.status, 'PREVIEW');
  assert.equal(result.metadata?.queued, true);
  assert.match(result.publishId ?? '', /^queue-/);
  assert.equal(publisher.calls.length, 0);
});

test('cat dry-run includes queue rejection preview for non-approved package', async () => {
  const result = await runMagazineDryRun({ topic: 'indoor enrichment' });
  const report = formatDryRunReport(result);

  assert.equal(result.queueResult?.status, 'rejected');
  assert.match(result.queueResult?.message ?? '', /requires APPROVED content/);
  assert.match(report, /Publishing Queue:/);
  assert.match(report, /Result: rejected/);
  assert.equal(result.schedulerResult?.status, 'rejected');
  assert.equal(result.executionResult?.status, 'SKIPPED');
  assert.match(report, /Scheduler:/);
  assert.match(report, /Execution Preview:/);
});

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
      message: 'Publisher should not be called in queue mode.'
    };
  }
}

function createQueue(): PublishingQueue {
  const persistence = createInMemoryPersistenceComposition();

  return new PublishingQueue({
    repository: persistence.publishingQueueRepository
  });
}

function createAuditedQueue(): { auditLog: AuditLog; queue: PublishingQueue } {
  const persistence = createInMemoryPersistenceComposition();
  const auditLog = new AuditLog(persistence.auditStore);
  const queue = new PublishingQueue({
    repository: persistence.publishingQueueRepository,
    auditLog
  });

  return {
    auditLog,
    queue
  };
}

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'Queued Cat Article',
      summary: 'A concise queued cat article summary.',
      body: 'This queued cat article explains indoor enrichment with enough structure for queue review.',
      slug: 'queued-cat-article',
      language: 'en-US',
      createdAt: '2026-07-10T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: [createTag('cat'), createTag('queue')]
      }
    },
    summary: {
      text: 'Queued package summary.'
    },
    seo: {
      metaTitle: 'Queued Cat Article',
      metaDescription: 'A dry-run SEO description for a queued cat article.',
      keywords: ['cat', 'queue']
    },
    faq: [
      {
        question: 'Is this published?',
        answer: 'No. This is a queue preview.'
      }
    ],
    imagePrompt: {
      prompt: 'Cat enrichment hero image.'
    },
    productPrompt: {
      prompt: 'Cat enrichment product suggestions.'
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
