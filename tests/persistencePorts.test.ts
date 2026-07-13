import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublishingQueueItem } from '../src/domain/publishingQueue/index.ts';
import {
  InMemoryIdempotencyStore,
  InMemoryLockManager,
  InMemoryUnitOfWork,
  type PageResult,
  type PublishingQueueRepository,
  type RevisionCheck,
  type Revisioned
} from '../src/services/persistence/index.ts';

test('persistence repository ports expose provider-neutral interface shape', async () => {
  const repository: PublishingQueueRepository = new RevisionedQueueRepository();
  const item = createQueueItem('queue-1');

  const created = await repository.create(item);
  const listed = await repository.list({ status: 'PENDING' });
  const found = await repository.getById('queue-1');

  assert.equal(created.revision, 1);
  assert.equal(found?.value.id, 'queue-1');
  assert.equal(listed.items.length, 1);
});

test('persistence repository ports support optimistic revision handling', async () => {
  const repository = new RevisionedQueueRepository();
  await repository.create(createQueueItem('queue-1'));

  const updated = await repository.updateStatus('queue-1', {
    status: 'APPROVED',
    updatedAt: '2026-07-13T00:01:00.000Z',
    expectedRevision: 1
  });

  assert.equal(updated.revision, 2);
  assert.equal(updated.value.status, 'APPROVED');

  await assert.rejects(
    () =>
      repository.updateStatus('queue-1', {
        status: 'SCHEDULED',
        updatedAt: '2026-07-13T00:02:00.000Z',
        expectedRevision: 1
      }),
    /Revision mismatch/
  );
});

test('in-memory idempotency store claims and returns existing records', async () => {
  const store = new InMemoryIdempotencyStore();
  const first = await store.claim('topic-1', 'queue');
  const second = await store.claim('topic-1', 'queue');

  assert.equal(first.status, 'CLAIMED');
  assert.equal(second.createdAt, first.createdAt);

  const completed = await store.complete('topic-1', 'queue', 'queue-1');
  const found = await store.get('topic-1', 'queue');

  assert.equal(completed.status, 'COMPLETED');
  assert.equal(found?.resultReference, 'queue-1');
});

test('in-memory idempotency store records failures', async () => {
  const store = new InMemoryIdempotencyStore();
  await store.claim('topic-1', 'queue');

  const failed = await store.fail('topic-1', 'queue', {
    reason: 'Queue creation failed.',
    code: 'queue_failed',
    retryable: true
  });

  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.failure?.retryable, true);
});

test('in-memory lock manager acquires renews and releases locks', async () => {
  const locks = new InMemoryLockManager();
  const acquired = await locks.acquire('scheduled-job:1:execution', 'executor-1', 1000, '2026-07-13T00:00:00.000Z');

  assert.ok(acquired);
  assert.equal(await locks.acquire('scheduled-job:1:execution', 'executor-2', 1000, '2026-07-13T00:00:00.500Z'), undefined);

  const renewed = await locks.renew(acquired, 2000, '2026-07-13T00:00:00.750Z');
  assert.ok(renewed);
  assert.equal(renewed.owner, 'executor-1');

  assert.equal(await locks.release(renewed), true);
  assert.equal(await locks.get('scheduled-job:1:execution'), undefined);
});

test('in-memory lock manager allows acquisition after ttl expiry', async () => {
  const locks = new InMemoryLockManager();
  await locks.acquire('scheduled-job:1:execution', 'executor-1', 1000, '2026-07-13T00:00:00.000Z');

  const acquiredAfterExpiry = await locks.acquire(
    'scheduled-job:1:execution',
    'executor-2',
    1000,
    '2026-07-13T00:00:01.001Z'
  );

  assert.equal(acquiredAfterExpiry?.owner, 'executor-2');
});

test('in-memory unit of work records commit and rollback behavior', async () => {
  const unitOfWork = new InMemoryUnitOfWork();

  const result = await unitOfWork.runInTransaction(async (context) => `committed:${context.id}`);
  assert.equal(result, 'committed:tx-1');
  assert.equal(unitOfWork.commits.length, 1);
  assert.equal(unitOfWork.rollbacks.length, 0);

  await assert.rejects(
    () =>
      unitOfWork.runInTransaction(async () => {
        throw new Error('rollback please');
      }),
    /rollback please/
  );

  assert.equal(unitOfWork.commits.length, 1);
  assert.equal(unitOfWork.rollbacks.length, 1);
});

class RevisionedQueueRepository implements PublishingQueueRepository {
  private readonly items = new Map<string, Revisioned<PublishingQueueItem>>();

  async create(item: PublishingQueueItem): Promise<Revisioned<PublishingQueueItem>> {
    const created = { value: item, revision: 1 };
    this.items.set(item.id, created);

    return created;
  }

  async getById(id: string): Promise<Revisioned<PublishingQueueItem> | undefined> {
    return this.items.get(id);
  }

  async list(): Promise<PageResult<Revisioned<PublishingQueueItem>>> {
    return {
      items: [...this.items.values()]
    };
  }

  async updateStatus(
    id: string,
    transition: { status: PublishingQueueItem['status']; updatedAt: string } & RevisionCheck
  ): Promise<Revisioned<PublishingQueueItem>> {
    const existing = this.requireItem(id);
    assertRevision(existing, transition);

    const updated = {
      value: {
        ...existing.value,
        status: transition.status,
        updatedAt: transition.updatedAt
      },
      revision: existing.revision + 1
    };
    this.items.set(id, updated);

    return updated;
  }

  async recordFailure(): Promise<Revisioned<PublishingQueueItem>> {
    throw new Error('Not needed for this port-shape test.');
  }

  async cancel(): Promise<Revisioned<PublishingQueueItem>> {
    throw new Error('Not needed for this port-shape test.');
  }

  async findByIdempotencyKey(): Promise<Revisioned<PublishingQueueItem> | undefined> {
    return undefined;
  }

  private requireItem(id: string): Revisioned<PublishingQueueItem> {
    const item = this.items.get(id);

    if (!item) {
      throw new Error(`Queue item not found: ${id}`);
    }

    return item;
  }
}

function assertRevision<T>(existing: Revisioned<T>, check: RevisionCheck): void {
  if (check.expectedRevision !== undefined && existing.revision !== check.expectedRevision) {
    throw new Error(`Revision mismatch. Expected ${check.expectedRevision}, got ${existing.revision}.`);
  }
}

function createQueueItem(id: string): PublishingQueueItem {
  return {
    id,
    status: 'PENDING',
    publishingPackage: {
      article: {
        title: 'Persistence Ports Article',
        summary: 'Summary',
        body: 'Body',
        slug: 'persistence-ports-article',
        language: 'en-US',
        createdAt: '2026-07-13T00:00:00.000Z',
        metadata: {
          status: 'draft',
          tags: []
        }
      },
      summary: {
        text: 'Summary'
      },
      seo: {
        metaTitle: 'Persistence Ports Article',
        metaDescription: 'Persistence ports planning.',
        keywords: []
      },
      faq: [
        {
          question: 'What is this?',
          answer: 'A persistence ports test fixture.'
        }
      ],
      imagePrompt: {
        prompt: 'Image prompt'
      },
      productPrompt: {
        prompt: 'Product prompt'
      },
      metadata: {}
    },
    destination: {
      type: 'wordpress',
      name: 'Preview',
      enabled: true
    },
    approvalDecision: 'APPROVED',
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z'
  };
}

