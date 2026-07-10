import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ApprovalResult } from '../src/domain/approval/index.ts';
import { createPublishingPackage, createTag, type PublishingPackage } from '../src/domain/content/index.ts';
import { AuditLog } from '../src/services/auditLog/index.ts';
import { PublishingQueue } from '../src/services/publishingQueue/index.ts';
import { ContentGenerationWorkflow } from '../src/workflows/index.ts';
import { MockAIProvider } from '../src/providers/ai/index.ts';
import { runMagazineDryRun } from '../src/magazines/runtime/index.ts';
import { formatDryRunReport } from '../scripts/dry-run.ts';

test('audit log records events', () => {
  const auditLog = new AuditLog();
  const event = auditLog.append({
    type: 'CONTENT_GENERATED',
    message: 'Content generated.',
    createdAt: '2026-07-10T00:00:00.000Z',
    context: {
      entityId: 'pkg-1',
      entityType: 'publishingPackage'
    }
  });

  assert.equal(event.id, 'audit-1');
  assert.equal(auditLog.listEvents().length, 1);
  assert.equal(auditLog.listEvents()[0].message, 'Content generated.');
});

test('audit log filters by entity and event type', () => {
  const auditLog = new AuditLog();

  auditLog.append({
    type: 'CONTENT_GENERATED',
    message: 'Package generated.',
    context: {
      entityId: 'pkg-1',
      entityType: 'publishingPackage'
    }
  });
  auditLog.append({
    type: 'QUEUE_CREATED',
    message: 'Queue created.',
    context: {
      entityId: 'queue-1',
      entityType: 'publishingQueueItem'
    }
  });

  assert.equal(auditLog.filterByEntity('pkg-1', 'publishingPackage').length, 1);
  assert.equal(auditLog.filterByEventType('QUEUE_CREATED').length, 1);
});

test('audit log preserves timeline ordering', () => {
  const auditLog = new AuditLog();

  auditLog.append({
    type: 'QUEUE_FAILED',
    message: 'Later event.',
    createdAt: '2026-07-10T00:00:02.000Z'
  });
  auditLog.append({
    type: 'CONTENT_GENERATED',
    message: 'Earlier event.',
    createdAt: '2026-07-10T00:00:01.000Z'
  });

  assert.deepEqual(
    auditLog.listEvents().map((event) => event.message),
    ['Earlier event.', 'Later event.']
  );
});

test('content generation workflow records audit events', async () => {
  const auditLog = new AuditLog();
  const workflow = new ContentGenerationWorkflow({
    aiProvider: new MockAIProvider(),
    auditLog
  });

  await workflow.execute({
    topic: 'indoor enrichment',
    language: 'en-US',
    metadata: {
      magazineSlug: 'cat',
      dryRun: true
    }
  });

  const eventTypes = auditLog.listEvents().map((event) => event.type);

  assert.ok(eventTypes.includes('CONTENT_GENERATED'));
  assert.ok(eventTypes.includes('QUALITY_EVALUATED'));
  assert.ok(eventTypes.includes('EDITORIAL_REVIEW_COMPLETED'));
  assert.ok(eventTypes.includes('APPROVAL_DECISION'));
});

test('publishing queue records queue audit events', async () => {
  const auditLog = new AuditLog();
  const queue = new PublishingQueue({ auditLog });
  const queued = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-10T00:00:00.000Z'
  });
  const failedItem = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-10T00:00:00.500Z'
  });

  await queue.cancelItem(queued.item?.id ?? '', 'Cancelled for editorial review.', '2026-07-10T00:00:01.000Z');
  await queue.recordFailure(failedItem.item?.id ?? '', {
    reason: 'Preview failed.',
    code: 'preview_failed'
  }, '2026-07-10T00:00:02.000Z');

  assert.deepEqual(
    auditLog.listEvents().map((event) => event.type),
    ['QUEUE_CREATED', 'QUEUE_CREATED', 'QUEUE_CANCELLED', 'QUEUE_FAILED']
  );
});

test('dry-run report includes audit timeline', async () => {
  const result = await runMagazineDryRun({ topic: 'indoor enrichment' });
  const report = formatDryRunReport(result);

  assert.ok((result.auditTimeline?.length ?? 0) >= 4);
  assert.match(report, /Audit Timeline:/);
  assert.match(report, /CONTENT_GENERATED/);
  assert.match(report, /APPROVAL_DECISION/);
});

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'Audited Cat Article',
      summary: 'A concise audited cat article summary.',
      body: 'This audited cat article explains indoor enrichment with enough structure for queue review.',
      slug: 'audited-cat-article',
      language: 'en-US',
      createdAt: '2026-07-10T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: [createTag('cat'), createTag('audit')]
      }
    },
    summary: {
      text: 'Audited package summary.'
    },
    seo: {
      metaTitle: 'Audited Cat Article',
      metaDescription: 'A dry-run SEO description for an audited cat article.',
      keywords: ['cat', 'audit']
    },
    faq: [
      {
        question: 'Is this published?',
        answer: 'No. This is an audit preview.'
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
