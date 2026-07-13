import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ApprovalResult } from '../src/domain/approval/index.ts';
import type { PublishingPackage } from '../src/domain/content/index.ts';
import type {
  StorageDownloadFileRequest,
  StorageFile,
  StorageFileMetadata,
  StorageProvider,
  StorageUploadFileRequest
} from '../src/domain/storage/index.ts';
import { AuditLog } from '../src/services/auditLog/index.ts';
import { AssetLibrary } from '../src/services/assetLibrary/index.ts';
import { MetricsService } from '../src/services/metrics/index.ts';
import {
  InMemoryAssetCatalogRepository,
  InMemoryAuditStore,
  InMemoryIdempotencyStore,
  InMemoryJobExecutionRepository,
  InMemoryLockManager,
  InMemoryMetricsStore,
  InMemoryPublishingQueueRepository,
  InMemorySchedulerRepository,
  InMemoryStorageMetadataRepository
} from '../src/services/persistence/index.ts';
import { PublishingQueue } from '../src/services/publishingQueue/index.ts';
import { ScheduledJobExecutor, SchedulerService } from '../src/services/scheduler/index.ts';

test('publishing queue behavior runs through repository port', async () => {
  const repository = new InMemoryPublishingQueueRepository();
  const queue = new PublishingQueue({ repository });

  const result = await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-13T00:00:00.000Z'
  });

  const persisted = await repository.getById(result.item?.id ?? '');

  assert.equal(result.status, 'queued');
  assert.equal(persisted?.value.id, result.item?.id);
  assert.equal(persisted?.revision, 1);
});

test('scheduler behavior runs through repository port', async () => {
  const queue = new PublishingQueue({ repository: new InMemoryPublishingQueueRepository() });
  const schedulerRepository = new InMemorySchedulerRepository();
  const scheduler = new SchedulerService({ queue, repository: schedulerRepository });
  const queueItem = (await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-13T00:00:00.000Z'
  })).item!;

  const result = await scheduler.schedule({
    queueItem,
    policy: {
      scheduledFor: '2026-07-13T01:00:00.000Z',
      timezone: 'Asia/Seoul'
    },
    now: '2026-07-13T00:10:00.000Z'
  });
  const persisted = await schedulerRepository.getById(result.job?.id ?? '');

  assert.equal(result.status, 'scheduled');
  assert.equal(persisted?.value.queueItemId, queueItem.id);
  assert.equal(persisted?.revision, 1);
});

test('in-memory repositories report stale revision conflicts', async () => {
  const repository = new InMemoryPublishingQueueRepository();
  const created = await repository.create(createQueueItemFixture('queue-1'));

  await repository.updateStatus('queue-1', {
    status: 'APPROVED',
    updatedAt: '2026-07-13T00:01:00.000Z',
    expectedRevision: created.revision
  });

  await assert.rejects(
    () =>
      repository.updateStatus('queue-1', {
        status: 'SCHEDULED',
        updatedAt: '2026-07-13T00:02:00.000Z',
        expectedRevision: created.revision
      }),
    /revision conflict/i
  );
});

test('scheduled job executor uses idempotency and lock ports for duplicate prevention', async () => {
  const queue = new PublishingQueue({ repository: new InMemoryPublishingQueueRepository() });
  const scheduler = new SchedulerService({
    queue,
    repository: new InMemorySchedulerRepository()
  });
  const executor = new ScheduledJobExecutor({
    scheduler,
    queue,
    repository: new InMemoryJobExecutionRepository(),
    idempotencyStore: new InMemoryIdempotencyStore(),
    lockManager: new InMemoryLockManager()
  });
  const queueItem = (await queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-13T00:00:00.000Z'
  })).item!;
  const scheduled = await scheduler.schedule({
    queueItem,
    policy: {
      scheduledFor: '2026-07-13T00:00:00.000Z',
      timezone: 'Asia/Seoul'
    },
    now: '2026-07-13T00:00:00.000Z'
  });

  const first = await executor.execute({
    jobId: scheduled.job?.id ?? '',
    operation: () => ({ preview: true }),
    now: '2026-07-13T00:00:00.000Z'
  });
  const duplicate = await executor.execute({
    jobId: scheduled.job?.id ?? '',
    operation: () => ({ preview: false }),
    now: '2026-07-13T00:00:01.000Z'
  });

  assert.equal(first.status, 'SUCCEEDED');
  assert.equal(duplicate.status, 'SKIPPED');
  assert.equal(duplicate.failure?.code, 'duplicate_execution');
});

test('audit ordering is preserved through AuditStore', () => {
  const auditLog = new AuditLog(new InMemoryAuditStore());

  auditLog.append({
    type: 'CONTENT_GENERATED',
    message: 'Second',
    createdAt: '2026-07-13T00:02:00.000Z'
  });
  auditLog.append({
    type: 'APPROVAL_DECISION',
    message: 'First',
    createdAt: '2026-07-13T00:01:00.000Z'
  });

  const events = auditLog.listEvents();

  assert.deepEqual(events.map((event) => event.message), ['First', 'Second']);
});

test('metrics snapshot is preserved through MetricsStore-backed service', () => {
  const metrics = new MetricsService({
    store: new InMemoryMetricsStore(),
    now: () => '2026-07-13T00:00:00.000Z'
  });

  metrics.incrementCounter('queue.enqueued');
  metrics.recordDuration('generation.duration', 125);
  metrics.recordFailure('publisher.failed', 'Publishing disabled.');

  const snapshot = metrics.snapshot('2026-07-13T00:01:00.000Z');

  assert.equal(snapshot.counters[0].name, 'queue.enqueued');
  assert.equal(snapshot.durations[0].averageMs, 125);
  assert.equal(snapshot.failures[0].lastFailureReason, 'Publishing disabled.');
});

test('asset registration and lookup run through AssetCatalogRepository', async () => {
  const catalogRepository = new InMemoryAssetCatalogRepository();
  const storageMetadataRepository = new InMemoryStorageMetadataRepository();
  const library = new AssetLibrary({
    storageProvider: new MemoryStorageProvider(),
    catalogRepository,
    storageMetadataRepository
  });

  const asset = await library.registerAsset({
    id: 'asset-1',
    filename: 'asset-1.jpg',
    mimeType: 'image/jpeg',
    category: 'article',
    tags: ['cat', 'window'],
    content: 'image-bytes',
    metadata: {
      checksum: 'checksum-1'
    }
  });
  const found = await catalogRepository.getById(asset.id);
  const storageRecords = await storageMetadataRepository.listFiles();

  assert.equal((await library.findAsset('asset-1'))?.filename, 'asset-1.jpg');
  assert.equal(found?.value.metadata?.checksum, 'checksum-1');
  assert.equal(storageRecords.items.length, 1);
});

class MemoryStorageProvider implements StorageProvider {
  readonly name = 'memory-storage';
  private readonly files = new Map<string, StorageFile>();

  async uploadFile(request: StorageUploadFileRequest): Promise<StorageFileMetadata> {
    const content = typeof request.content === 'string' ? new TextEncoder().encode(request.content) : request.content;
    const metadata: StorageFileMetadata = {
      id: `file-${this.files.size + 1}`,
      path: request.path,
      name: request.path.split('/').at(-1) ?? request.path,
      size: content.byteLength,
      contentType: request.contentType,
      provider: this.name,
      metadata: request.metadata
    };

    this.files.set(request.path, {
      metadata,
      content
    });

    return metadata;
  }

  async downloadFile(request: StorageDownloadFileRequest): Promise<StorageFile> {
    const file = this.files.get(request.path);

    if (!file) {
      throw new Error(`Missing file: ${request.path}`);
    }

    return file;
  }

  async listFiles(): Promise<StorageFileMetadata[]> {
    return [...this.files.values()].map((file) => file.metadata);
  }

  async createFolder() {
    return {
      id: 'folder-1',
      path: 'folder',
      name: 'folder',
      provider: this.name
    };
  }

  async getFileMetadata(path: string): Promise<StorageFileMetadata | null> {
    return this.files.get(path)?.metadata ?? null;
  }
}

function createApprovalFixture(decision: ApprovalResult['decision']): ApprovalResult {
  return {
    decision,
    status: decision === 'APPROVED' ? 'ready' : decision === 'NEEDS_REVIEW' ? 'review_required' : 'blocked',
    reasons: [],
    recommendations: [],
    blockingIssues: [],
    nonBlockingIssues: [],
    reviewedAt: '2026-07-13T00:00:00.000Z'
  };
}

function createDestination() {
  return {
    type: 'wordpress' as const,
    name: 'WordPress Preview',
    enabled: true,
    dryRunOnly: true
  };
}

function createQueueItemFixture(id: string) {
  return {
    id,
    status: 'PENDING' as const,
    publishingPackage: createPackageFixture(),
    destination: createDestination(),
    approvalDecision: 'APPROVED' as const,
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z'
  };
}

function createPackageFixture(): PublishingPackage {
  return {
    article: {
      title: 'Persistence Service Migration',
      summary: 'A migration test package.',
      body: 'A body with enough structure for persistence service migration tests.',
      slug: 'persistence-service-migration',
      language: 'en-US',
      createdAt: '2026-07-13T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: []
      }
    },
    summary: {
      text: 'A migration test package.'
    },
    seo: {
      metaTitle: 'Persistence Service Migration',
      metaDescription: 'Testing persistence service migration.',
      keywords: ['persistence']
    },
    faq: [
      {
        question: 'What is being tested?',
        answer: 'Service migration onto persistence ports.'
      }
    ],
    imagePrompt: {
      prompt: 'An abstract persistence architecture diagram.'
    },
    productPrompt: {
      prompt: 'Developer tooling recommendations.'
    },
    metadata: {}
  };
}
