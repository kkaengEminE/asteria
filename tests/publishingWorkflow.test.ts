import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ApprovalResult } from '../src/domain/approval/index.ts';
import { createPublishingPackage, createTag, type PublishingPackage } from '../src/domain/content/index.ts';
import type { PublishRequest, PublishResult, Publisher } from '../src/domain/publisher/index.ts';
import { PublishingWorkflow } from '../src/services/publishing/index.ts';

test('publishing workflow blocks real publishing when disabled', async () => {
  const publisher = new CountingPublisher();
  const workflow = new PublishingWorkflow({
    publisher,
    config: {
      dryRun: false,
      publishingEnabled: false,
      requireApproval: true
    }
  });

  const result = await workflow.execute({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination()
  });

  assert.equal(result.status, 'SKIPPED');
  assert.match(result.message, /Publishing is disabled/);
  assert.equal(publisher.calls.length, 0);
});

test('publishing workflow requires approved publishing package', async () => {
  const publisher = new CountingPublisher();
  const workflow = new PublishingWorkflow({
    publisher,
    config: {
      dryRun: true,
      publishingEnabled: false,
      requireApproval: true
    }
  });

  const result = await workflow.execute({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('NEEDS_REVIEW'),
    destination: createDestination()
  });

  assert.equal(result.status, 'SKIPPED');
  assert.match(result.message, /requires APPROVED content/);
  assert.equal(result.metadata?.approvalDecision, 'NEEDS_REVIEW');
  assert.equal(publisher.calls.length, 0);
});

test('publishing workflow maps approved package into publish request', async () => {
  const publisher = new CountingPublisher();
  const workflow = new PublishingWorkflow({
    publisher,
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
  assert.equal(publisher.calls.length, 1);
  assert.equal(publisher.calls[0].publishingPackage.article.title, 'Approved Cat Article');
  assert.equal(publisher.calls[0].publishingPackage.article.slug, 'approved-cat-article');
  assert.deepEqual(
    publisher.calls[0].publishingPackage.article.metadata.tags.map((tag) => tag.name),
    ['approved', 'cat']
  );
  assert.equal(publisher.calls[0].mode, 'preview');
});

test('publishing workflow dry-run preview makes no external api call', async () => {
  const publisher = new CountingPublisher();
  const workflow = new PublishingWorkflow({
    publisher,
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
  assert.equal(publisher.calls.length, 1);
  assert.equal(result.metadata?.dryRun, true);
  assert.equal(result.metadata?.title, 'Approved Cat Article');
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
      publishId: 'preview-approved-cat-article',
      previewUrl: 'https://preview.asteria.local/wordpress/preview-approved-cat-article',
      message: 'Dry-run publisher called.',
      metadata: {
        dryRun: true,
        title: request.publishingPackage.article.title
      }
    };
  }
}

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'Approved Cat Article',
      summary: 'A concise approved cat article summary.',
      body: 'This approved cat article explains indoor enrichment with enough structure for preview publishing.',
      slug: 'approved-cat-article',
      language: 'en-US',
      createdAt: '2026-07-08T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: [createTag('cat'), createTag('approved')]
      }
    },
    summary: {
      text: 'Approved package summary.'
    },
    seo: {
      metaTitle: 'Approved Cat Article',
      metaDescription: 'A dry-run SEO description for an approved cat article.',
      keywords: ['cat', 'approved']
    },
    faq: [
      {
        question: 'Is this published?',
        answer: 'No. This is a dry-run publishing preview.'
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
    approvedAt: decision === 'APPROVED' ? '2026-07-08T00:00:00.000Z' : undefined,
    reviewedAt: '2026-07-08T00:00:00.000Z'
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
