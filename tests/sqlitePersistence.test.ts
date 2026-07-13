import assert from 'node:assert/strict';
import { mkdtemp, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import type { ApprovalResult } from '../src/domain/approval/index.ts';
import { createPublishingPackage, createTag, type PublishingPackage } from '../src/domain/content/index.ts';
import type { PublishingQueueItem } from '../src/domain/publishingQueue/index.ts';
import type { ScheduledJob, ScheduledJobExecution } from '../src/domain/scheduler/index.ts';
import { createSQLitePersistenceConfigFromEnv, createSQLitePersistenceComposition, migrateSQLiteDatabase, SQLiteConnection } from '../src/providers/persistence/sqlite/index.ts';
import { runMagazineDryRun } from '../src/magazines/runtime/index.ts';
import { PersistenceRevisionConflictError } from '../src/services/persistence/index.ts';
import { PublishingQueue } from '../src/services/publishingQueue/index.ts';
import { SchedulerService } from '../src/services/scheduler/index.ts';
import { runQualityLabCli } from '../scripts/quality-lab.ts';

test('sqlite migration initializes schema and is repeatable', async () => {
  const databasePath = await createDatabasePath();
  const first = createSQLitePersistenceComposition({ databasePath });
  first.sqliteConnection.close();

  const second = createSQLitePersistenceComposition({ databasePath });
  const rows = second.sqliteConnection.database.prepare('SELECT version FROM schema_migrations').all();

  assert.deepEqual(rows.map((row) => Number(row.version)), [1]);
  second.sqliteConnection.close();
});

test('sqlite migration fails on unsupported schema version', async () => {
  const databasePath = await createDatabasePath();
  const connection = new SQLiteConnection(databasePath);
  migrateSQLiteDatabase(connection.database);
  connection.database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(999, '2026-07-10T00:00:00.000Z');
  connection.close();

  assert.throws(
    () => createSQLitePersistenceComposition({ databasePath }),
    /Unsupported SQLite schema version 999/
  );
});

test('sqlite queue persists across repository instances', async () => {
  const databasePath = await createDatabasePath();
  const first = createSQLitePersistenceComposition({ databasePath });
  const queue = new PublishingQueue({ repository: first.publishingQueueRepository });
  const queued = await enqueueApproved(queue);
  first.sqliteConnection.close();

  const second = createSQLitePersistenceComposition({ databasePath });
  const loaded = await second.publishingQueueRepository.getById(queued.item!.id);

  assert.equal(loaded?.value.id, queued.item!.id);
  assert.equal(loaded?.value.status, 'APPROVED');
  assert.equal(loaded?.revision, 1);
  second.sqliteConnection.close();
});

test('sqlite scheduler persists scheduled jobs', async () => {
  const persistence = createSQLitePersistenceComposition({ databasePath: await createDatabasePath() });
  const queue = new PublishingQueue({ repository: persistence.publishingQueueRepository });
  const scheduler = new SchedulerService({
    repository: persistence.schedulerRepository,
    queue
  });
  const queued = await enqueueApproved(queue);
  const scheduled = await scheduler.schedule({
    queueItem: queued.item!,
    policy: createSchedulePolicy(),
    now: '2026-07-10T00:01:00.000Z'
  });

  assert.equal(scheduled.status, 'scheduled');
  persistence.sqliteConnection.close();

  const reopened = createSQLitePersistenceComposition({ databasePath: persistence.sqliteConnection.databasePath });
  const loaded = await reopened.schedulerRepository.getById(scheduled.job!.id);

  assert.equal(loaded?.value.queueItemId, queued.item!.id);
  assert.equal(loaded?.value.status, 'SCHEDULED');
  reopened.sqliteConnection.close();
});

test('sqlite execution records persist', async () => {
  const databasePath = await createDatabasePath();
  const first = createSQLitePersistenceComposition({ databasePath });
  await first.jobExecutionRepository.createExecution(createExecution('execution-1', 'job-1'));
  first.sqliteConnection.close();

  const second = createSQLitePersistenceComposition({ databasePath });
  const loaded = await second.jobExecutionRepository.getById('execution-1');

  assert.equal(loaded?.value.jobId, 'job-1');
  assert.equal(loaded?.value.status, 'RUNNING');
  second.sqliteConnection.close();
});

test('sqlite repositories preserve optimistic revision conflicts', async () => {
  const persistence = createSQLitePersistenceComposition({ databasePath: await createDatabasePath() });
  const created = await persistence.publishingQueueRepository.create(createQueueItem('queue-1'));

  await persistence.publishingQueueRepository.updateStatus('queue-1', {
    status: 'SCHEDULED',
    updatedAt: '2026-07-10T00:01:00.000Z',
    expectedRevision: created.revision
  });

  await assert.rejects(
    () =>
      persistence.publishingQueueRepository.updateStatus('queue-1', {
        status: 'PROCESSING',
        updatedAt: '2026-07-10T00:02:00.000Z',
        expectedRevision: created.revision
      }),
    PersistenceRevisionConflictError
  );
  persistence.sqliteConnection.close();
});

test('sqlite unit of work rolls back queue update and scheduled job creation', async () => {
  const persistence = createSQLitePersistenceComposition({ databasePath: await createDatabasePath() });
  const created = await persistence.publishingQueueRepository.create(createQueueItem('queue-1'));

  await assert.rejects(
    () =>
      persistence.unitOfWork.runInTransaction(async () => {
        await persistence.publishingQueueRepository.updateStatus('queue-1', {
          status: 'SCHEDULED',
          updatedAt: '2026-07-10T00:01:00.000Z',
          expectedRevision: created.revision
        });
        await persistence.schedulerRepository.create(createScheduledJob('job-1', 'queue-1'));
        throw new Error('rollback this transaction');
      }),
    /rollback this transaction/
  );

  assert.equal((await persistence.publishingQueueRepository.getById('queue-1'))?.value.status, 'APPROVED');
  assert.equal(await persistence.schedulerRepository.getById('job-1'), undefined);
  persistence.sqliteConnection.close();
});

test('sqlite unit of work rolls back processing transition and execution record creation', async () => {
  const persistence = createSQLitePersistenceComposition({ databasePath: await createDatabasePath() });
  const created = await persistence.publishingQueueRepository.create(createQueueItem('queue-1', 'SCHEDULED'));

  await assert.rejects(
    () =>
      persistence.unitOfWork.runInTransaction(async () => {
        await persistence.publishingQueueRepository.updateStatus('queue-1', {
          status: 'PROCESSING',
          updatedAt: '2026-07-10T00:01:00.000Z',
          expectedRevision: created.revision
        });
        await persistence.jobExecutionRepository.createExecution(createExecution('execution-1', 'job-1', 'queue-1'));
        throw new Error('rollback execution transaction');
      }),
    /rollback execution transaction/
  );

  assert.equal((await persistence.publishingQueueRepository.getById('queue-1'))?.value.status, 'SCHEDULED');
  assert.equal(await persistence.jobExecutionRepository.getById('execution-1'), undefined);
  persistence.sqliteConnection.close();
});

test('sqlite idempotency records persist completion and failure states', async () => {
  const databasePath = await createDatabasePath();
  const first = createSQLitePersistenceComposition({ databasePath });
  await first.idempotencyStore.claim('key-1', 'scope-1', { topic: 'cats' });
  await first.idempotencyStore.complete('key-1', 'scope-1', 'result-1');
  await first.idempotencyStore.claim('key-2', 'scope-1');
  await first.idempotencyStore.fail('key-2', 'scope-1', {
    reason: 'failed on purpose',
    code: 'test_failure',
    retryable: true
  });
  first.sqliteConnection.close();

  const second = createSQLitePersistenceComposition({ databasePath });

  assert.equal((await second.idempotencyStore.get('key-1', 'scope-1'))?.status, 'COMPLETED');
  assert.equal((await second.idempotencyStore.get('key-1', 'scope-1'))?.resultReference, 'result-1');
  assert.equal((await second.idempotencyStore.get('key-2', 'scope-1'))?.failure?.code, 'test_failure');
  second.sqliteConnection.close();
});

test('sqlite locks support ttl expiry renew and release', async () => {
  const persistence = createSQLitePersistenceComposition({ databasePath: await createDatabasePath() });
  const acquired = await persistence.lockManager.acquire('lock-1', 'owner-1', 1000, '2099-07-10T00:00:00.000Z');

  assert.ok(acquired);
  assert.equal(await persistence.lockManager.acquire('lock-1', 'owner-2', 1000, '2099-07-10T00:00:00.500Z'), undefined);

  const renewed = await persistence.lockManager.renew(acquired!, 1000, '2099-07-10T00:00:00.800Z');

  assert.equal(renewed?.expiresAt, '2099-07-10T00:00:01.800Z');
  assert.deepEqual(await persistence.lockManager.get('lock-1'), renewed);
  assert.equal(await persistence.lockManager.release(renewed!), true);
  assert.equal(await persistence.lockManager.get('lock-1'), undefined);

  const expired = await persistence.lockManager.acquire('lock-1', 'owner-3', 1000, '2099-07-10T00:00:00.000Z');
  assert.ok(expired);
  assert.deepEqual(await persistence.lockManager.get('lock-1'), expired);
  assert.equal(await persistence.lockManager.acquire('lock-1', 'owner-4', 1000, '2099-07-10T00:00:02.000Z') !== undefined, true);
  persistence.sqliteConnection.close();
});

test('runtime persistence defaults to memory and selects sqlite explicitly', async () => {
  assert.equal(createSQLitePersistenceConfigFromEnv({}).mode, 'memory');
  assert.equal(createSQLitePersistenceConfigFromEnv({ ASTERIA_PERSISTENCE_MODE: 'memory' }).mode, 'memory');
  assert.throws(
    () => createSQLitePersistenceConfigFromEnv({ ASTERIA_PERSISTENCE_MODE: 'sqlite' }),
    /ASTERIA_SQLITE_DATABASE_PATH/
  );

  const databasePath = await createDatabasePath();
  const result = await runMagazineDryRun({
    persistenceEnv: {
      ASTERIA_PERSISTENCE_MODE: 'sqlite',
      ASTERIA_SQLITE_DATABASE_PATH: databasePath
    }
  });

  assert.equal(result.workflowStatus, 'success');
  await stat(databasePath);
});

test('sqlite dry-run path remains compatible with quality lab', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asteria-quality-lab-sqlite-'));
  const topicsPath = join(dir, 'topics.txt');
  const outputPath = join(dir, 'report.md');
  const databasePath = join(dir, 'quality-lab.sqlite');
  const previousMode = process.env.ASTERIA_PERSISTENCE_MODE;
  const previousPath = process.env.ASTERIA_SQLITE_DATABASE_PATH;

  await writeFile(topicsPath, 'indoor enrichment for cats\n', 'utf8');
  process.env.ASTERIA_PERSISTENCE_MODE = 'sqlite';
  process.env.ASTERIA_SQLITE_DATABASE_PATH = databasePath;

  try {
    await runQualityLabCli([topicsPath, '--output', outputPath]);
    await stat(outputPath);
    await stat(databasePath);
  } finally {
    restoreEnv('ASTERIA_PERSISTENCE_MODE', previousMode);
    restoreEnv('ASTERIA_SQLITE_DATABASE_PATH', previousPath);
  }
});

async function createDatabasePath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'asteria-sqlite-'));
  return join(dir, 'asteria.sqlite');
}

async function enqueueApproved(queue: PublishingQueue) {
  return queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-10T00:00:00.000Z'
  });
}

function createQueueItem(id: string, status: PublishingQueueItem['status'] = 'APPROVED'): PublishingQueueItem {
  return {
    id,
    status,
    publishingPackage: createPackageFixture(),
    destination: createDestination(),
    approvalDecision: 'APPROVED',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    metadata: {
      magazineSlug: 'cat',
      idempotencyKey: `${id}:idempotency`
    }
  };
}

function createScheduledJob(id: string, queueItemId: string): ScheduledJob {
  return {
    id,
    queueItemId,
    status: 'SCHEDULED',
    policy: createSchedulePolicy(),
    scheduledFor: '2026-07-10T00:05:00.000Z',
    createdAt: '2026-07-10T00:01:00.000Z',
    updatedAt: '2026-07-10T00:01:00.000Z'
  };
}

function createExecution(id: string, jobId: string, queueItemId = 'queue-1'): ScheduledJobExecution {
  return {
    id,
    jobId,
    queueItemId,
    status: 'RUNNING',
    due: true,
    attemptCount: 0,
    retryCount: 0,
    startedAt: '2026-07-10T00:02:00.000Z'
  };
}

function createSchedulePolicy() {
  return {
    scheduledFor: '2026-07-10T00:05:00.000Z',
    timezone: 'UTC'
  };
}

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'SQLite Cat Article',
      summary: 'A concise SQLite cat article summary.',
      body: 'This SQLite cat article verifies local durable persistence without publishing.',
      slug: 'sqlite-cat-article',
      language: 'en-US',
      createdAt: '2026-07-10T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: [createTag('cat'), createTag('sqlite')]
      }
    },
    summary: {
      text: 'SQLite package summary.'
    },
    seo: {
      metaTitle: 'SQLite Cat Article',
      metaDescription: 'A dry-run SEO description for a SQLite cat article.',
      keywords: ['cat', 'sqlite']
    },
    faq: [
      {
        question: 'Is this published?',
        answer: 'No. This is a local persistence test.'
      }
    ],
    imagePrompt: {
      prompt: 'Cat SQLite preview image.'
    },
    productPrompt: {
      prompt: 'Cat SQLite preview products.'
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

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
