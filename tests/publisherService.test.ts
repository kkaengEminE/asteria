import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublishingPackage, createTag, type PublishingPackage } from '../src/domain/content/index.ts';
import type {
  PublishRequest,
  PublishResult,
  Publisher
} from '../src/domain/publisher/index.ts';
import { AuditLog } from '../src/services/auditLog/index.ts';
import { createInMemoryPersistenceComposition } from '../src/services/persistence/index.ts';
import { DryRunPublisher, PublisherService } from '../src/services/publisher/index.ts';

test('dry run publisher generates deterministic preview result', async () => {
  const publisher = new DryRunPublisher();
  const result = await publisher.publish(createPublishRequest());

  assert.equal(result.status, 'PREVIEW');
  assert.equal(result.publisher, 'dry-run-publisher');
  assert.equal(result.publishId, 'preview-cat-magazine-wordpress-publisher-foundation-article');
  assert.equal(result.previewUrl, 'https://preview.asteria.local/wordpress/preview-cat-magazine-wordpress-publisher-foundation-article');
});

test('publisher service dispatches to configured dry-run publisher when publishing is disabled', async () => {
  const service = new PublisherService({
    publisher: new DryRunPublisher(),
    publishingEnabled: false
  });
  const result = await service.publish(createPublishRequest({
    mode: 'production'
  }));

  assert.equal(result.status, 'PREVIEW');
  assert.equal(result.mode, 'preview');
  assert.equal(result.metadata?.published, false);
});

test('publisher service skips non-dry-run publisher while publishing is disabled', async () => {
  const publisher = new CountingPublisher();
  const service = new PublisherService({
    publisher,
    publishingEnabled: false
  });
  const result = await service.publish(createPublishRequest());

  assert.equal(result.status, 'SKIPPED');
  assert.equal(result.failure?.code, 'publishing_disabled');
  assert.equal(publisher.calls, 0);
});

test('publisher service retries retryable publisher failures', async () => {
  const publisher = new FlakyPublisher();
  const service = new PublisherService({
    publisher,
    publishingEnabled: true,
    retryPolicy: {
      maxAttempts: 2,
      delayMs: 25,
      retryableReasons: ['temporary_publish_failure']
    }
  });
  const result = await service.publish(createPublishRequest({
    mode: 'production'
  }));

  assert.equal(result.status, 'PUBLISHED');
  assert.equal(result.metadata?.attemptCount, 2);
  assert.equal(result.metadata?.retryCount, 1);
  assert.equal(publisher.calls, 2);
});

test('publisher service records audit events', async () => {
  const auditLog = createAuditLog();
  const service = new PublisherService({
    auditLog,
    publisher: new DryRunPublisher(),
    publishingEnabled: false
  });

  await service.publish(createPublishRequest());

  assert.equal(auditLog.filterByEventType('PUBLISH_STARTED').length, 1);
  assert.equal(auditLog.filterByEventType('PUBLISH_SUCCEEDED').length, 1);
});

test('publisher service records skipped audit event', async () => {
  const auditLog = createAuditLog();
  const service = new PublisherService({
    auditLog,
    publisher: new CountingPublisher(),
    publishingEnabled: false
  });

  await service.publish(createPublishRequest());

  assert.equal(auditLog.filterByEventType('PUBLISH_SKIPPED').length, 1);
});

function createPublishRequest(overrides: Partial<PublishRequest> = {}): PublishRequest {
  return {
    publishingPackage: createPackageFixture(),
    destination: {
      type: 'wordpress',
      name: 'Cat Magazine WordPress',
      enabled: true,
      dryRunOnly: true
    },
    mode: 'preview',
    metadata: {
      dryRun: true
    },
    ...overrides
  };
}

function createAuditLog(): AuditLog {
  return new AuditLog(createInMemoryPersistenceComposition().auditStore);
}

class CountingPublisher implements Publisher {
  readonly name = 'counting-publisher';
  readonly mode = 'production-capable' as const;
  calls = 0;

  async publish(request: PublishRequest): Promise<PublishResult> {
    this.calls += 1;

    return {
      status: 'PUBLISHED',
      publisher: this.name,
      mode: request.mode ?? 'production',
      destination: request.destination,
      publishId: 'published-1',
      message: 'Published.'
    };
  }
}

class FlakyPublisher implements Publisher {
  readonly name = 'flaky-publisher';
  readonly mode = 'production-capable' as const;
  calls = 0;

  async publish(request: PublishRequest): Promise<PublishResult> {
    this.calls += 1;

    if (this.calls === 1) {
      return {
        status: 'FAILED',
        publisher: this.name,
        mode: request.mode ?? 'production',
        destination: request.destination,
        failure: {
          code: 'temporary_publish_failure',
          reason: 'Temporary publisher failure.',
          retryable: true
        },
        message: 'Temporary publisher failure.'
      };
    }

    return {
      status: 'PUBLISHED',
      publisher: this.name,
      mode: request.mode ?? 'production',
      destination: request.destination,
      publishId: 'published-2',
      message: 'Published after retry.'
    };
  }
}

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'Publisher Foundation Article',
      summary: 'A concise publisher foundation summary.',
      body: 'This article is used to verify dry-run publisher behavior without network calls.',
      slug: 'publisher-foundation-article',
      language: 'en-US',
      author: 'Asteria',
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: [createTag('publishing')]
      }
    },
    summary: {
      text: 'Publisher foundation summary.'
    },
    seo: {
      metaTitle: 'Publisher Foundation Article',
      metaDescription: 'Publisher foundation dry-run preview.',
      keywords: ['publishing']
    },
    faq: [
      {
        question: 'Does this publish content?',
        answer: 'No. It only creates a dry-run preview.'
      }
    ],
    imagePrompt: {
      prompt: 'Publisher foundation image prompt.'
    },
    productPrompt: {
      prompt: 'Publisher foundation product prompt.'
    },
    metadata: {
      approvalDecision: 'APPROVED'
    }
  });
}
