import assert from 'node:assert/strict';
import { mkdtemp, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import type { ApprovalResult } from '../src/domain/approval/index.ts';
import { createPublishingPackage, createTag, type PublishingPackage } from '../src/domain/content/index.ts';
import type { PublishingQueueItem } from '../src/domain/publishingQueue/index.ts';
import type { ScheduledJob } from '../src/domain/scheduler/index.ts';
import { createSQLitePersistenceComposition, type SQLitePersistenceComposition } from '../src/providers/persistence/sqlite/index.ts';
import { runMagazineDryRun } from '../src/magazines/runtime/index.ts';
import type { LockManager, LockToken, UnitOfWork } from '../src/services/persistence/index.ts';
import { PersistenceRevisionConflictError, type PersistenceComposition, type TransactionContext } from '../src/services/persistence/index.ts';
import { PublishingQueue } from '../src/services/publishingQueue/index.ts';
import { ScheduledJobExecutor, SchedulerService } from '../src/services/scheduler/index.ts';
import { runQualityLabCli } from '../scripts/quality-lab.ts';

test('sqlite operational flow validates queue scheduler executor retry idempotency locks and restart behavior', async () => {
  const databasePath = await createDatabasePath();
  const metrics = createOperationalMetrics();
  const firstStartupStart = Date.now();
  const firstPersistence = wrapOperationalPersistence(createSQLitePersistenceComposition({ databasePath }), metrics);
  metrics.migrationMs += Date.now() - firstStartupStart;
  const setup = await createOperationalSetup(firstPersistence);

  const enqueued = await setup.queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-10T00:00:00.000Z'
  });

  assert.equal(enqueued.status, 'queued');

  const scheduled = await firstPersistence.unitOfWork.runInTransaction(async () =>
    setup.scheduler.schedule({
      queueItem: enqueued.item!,
      policy: {
        scheduledFor: '2026-07-10T09:00:00.000Z',
        timezone: 'UTC'
      },
      now: '2026-07-10T00:01:00.000Z'
    })
  );

  assert.equal(scheduled.status, 'scheduled');
  assert.equal((await setup.queue.getItem(enqueued.item!.id))?.status, 'SCHEDULED');

  const rescheduled = await setup.scheduler.reschedule({
    id: scheduled.job!.id,
    policy: {
      scheduledFor: '2026-07-10T09:30:00.000Z',
      timezone: 'UTC'
    },
    reason: 'Operational validation reschedule.',
    now: '2026-07-10T00:02:00.000Z'
  });

  assert.equal(rescheduled.status, 'rescheduled');

  const stale = await firstPersistence.publishingQueueRepository.getById(enqueued.item!.id);
  await firstPersistence.publishingQueueRepository.updateStatus(enqueued.item!.id, {
    status: 'SCHEDULED',
    updatedAt: '2026-07-10T00:03:00.000Z',
    expectedRevision: stale!.revision
  });
  await assert.rejects(
    () =>
      firstPersistence.publishingQueueRepository.updateStatus(enqueued.item!.id, {
        status: 'PROCESSING',
        updatedAt: '2026-07-10T00:04:00.000Z',
        expectedRevision: stale!.revision
      }),
    PersistenceRevisionConflictError
  );

  await assert.rejects(
    () =>
      firstPersistence.unitOfWork.runInTransaction(async () => {
        await firstPersistence.publishingQueueRepository.updateStatus(enqueued.item!.id, {
          status: 'PROCESSING',
          updatedAt: '2026-07-10T00:05:00.000Z'
        });
        throw new Error('rollback validation');
      }),
    /rollback validation/
  );
  assert.equal((await setup.queue.getItem(enqueued.item!.id))?.status, 'SCHEDULED');

  let failingCalls = 0;
  const failedExecution = await setup.executor.execute({
    jobId: scheduled.job!.id,
    now: '2026-07-10T10:00:00.000Z',
    retryPolicy: {
      maxAttempts: 2,
      delayMs: 1,
      retryableReasons: ['temporary_execution_failure']
    },
    operation: () => {
      failingCalls += 1;
      metrics.retryCount += failingCalls > 1 ? 1 : 0;
      const error = new Error('Temporary execution failure.');
      (error as Error & { code: string; retryable: boolean }).code = 'temporary_execution_failure';
      (error as Error & { code: string; retryable: boolean }).retryable = true;
      throw error;
    }
  });

  assert.equal(failedExecution.status, 'FAILED');
  assert.equal(failedExecution.attemptCount, 2);
  assert.equal((await firstPersistence.idempotencyStore.get(`scheduled-job:${scheduled.job!.id}`, 'scheduled-job-execution'))?.status, 'FAILED');
  assert.equal(await firstPersistence.lockManager.get(`scheduled-job:${scheduled.job!.id}`), undefined);
  assert.equal((await setup.queue.getItem(enqueued.item!.id))?.status, 'FAILED');

  await setup.queue.updateStatus(enqueued.item!.id, 'PENDING', '2026-07-10T10:01:00.000Z', { retried: true });
  await setup.queue.updateStatus(enqueued.item!.id, 'APPROVED', '2026-07-10T10:02:00.000Z');
  await setup.queue.updateStatus(enqueued.item!.id, 'SCHEDULED', '2026-07-10T10:03:00.000Z');

  firstPersistence.sqliteConnection.close();

  const secondStartupStart = Date.now();
  const secondPersistence = wrapOperationalPersistence(createSQLitePersistenceComposition({ databasePath }), metrics);
  metrics.migrationMs += Date.now() - secondStartupStart;
  metrics.startupCount += 1;
  const restartedSetup = await createOperationalSetup(secondPersistence);

  let calls = 0;
  const succeeded = await restartedSetup.executor.execute({
    jobId: scheduled.job!.id,
    now: '2026-07-10T10:04:00.000Z',
    retryPolicy: {
      maxAttempts: 2,
      delayMs: 1,
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

      return { ok: true };
    }
  });

  assert.equal(succeeded.status, 'SUCCEEDED');
  assert.equal(succeeded.attemptCount, 2);
  assert.equal(succeeded.retryCount, 1);
  assert.equal(succeeded.execution?.id, 'execution-2');
  assert.equal((await secondPersistence.idempotencyStore.get(`scheduled-job:${scheduled.job!.id}`, 'scheduled-job-execution'))?.status, 'COMPLETED');
  assert.equal(await secondPersistence.lockManager.get(`scheduled-job:${scheduled.job!.id}`), undefined);

  const duplicate = await restartedSetup.executor.execute({
    jobId: scheduled.job!.id,
    now: '2026-07-10T10:05:00.000Z',
    operation: () => ({ shouldNotRun: true })
  });

  assert.equal(duplicate.status, 'SKIPPED');
  assert.equal(duplicate.failure?.code, 'duplicate_execution');

  const expired = await secondPersistence.lockManager.acquire('manual-lock', 'owner-a', 1000, '2099-07-10T00:00:00.000Z');
  assert.ok(expired);
  assert.equal(await secondPersistence.lockManager.acquire('manual-lock', 'owner-b', 1000, '2099-07-10T00:00:02.000Z') !== undefined, true);

  const thirdPersistence = createSQLitePersistenceComposition({ databasePath });
  const versions = thirdPersistence.sqliteConnection.database.prepare('SELECT version FROM schema_migrations').all();

  assert.deepEqual(versions.map((row) => Number(row.version)), [1]);
  assert.equal((await thirdPersistence.schedulerRepository.getById(scheduled.job!.id))?.value.scheduledFor, '2026-07-10T09:30:00.000Z');
  assert.equal((await thirdPersistence.jobExecutionRepository.list({ jobId: scheduled.job!.id })).items.length >= 2, true);
  assert.equal(metrics.transactionCount >= 2, true);
  assert.equal(metrics.rollbackCount >= 1, true);
  assert.equal(metrics.lockAcquireCount >= 4, true);
  assert.equal(metrics.retryCount >= 1, true);
  assert.equal(metrics.startupCount, 2);
  assert.equal(metrics.migrationMs >= 0, true);

  thirdPersistence.sqliteConnection.close();
  secondPersistence.sqliteConnection.close();
});

test('sqlite operational validation supports dry-run and quality lab mode', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asteria-sqlite-operational-cli-'));
  const dryRunDatabasePath = join(dir, 'dry-run.sqlite');
  const qualityLabDatabasePath = join(dir, 'quality-lab.sqlite');
  const topicsPath = join(dir, 'topics.txt');
  const outputPath = join(dir, 'quality-report.md');
  const previousMode = process.env.ASTERIA_PERSISTENCE_MODE;
  const previousPath = process.env.ASTERIA_SQLITE_DATABASE_PATH;

  const dryRunResult = await runMagazineDryRun({
    persistenceEnv: {
      ASTERIA_PERSISTENCE_MODE: 'sqlite',
      ASTERIA_SQLITE_DATABASE_PATH: dryRunDatabasePath
    }
  });

  assert.equal(dryRunResult.workflowStatus, 'success');
  await stat(dryRunDatabasePath);

  await writeFile(topicsPath, 'indoor enrichment for cats\ncat hydration tips\n', 'utf8');
  process.env.ASTERIA_PERSISTENCE_MODE = 'sqlite';
  process.env.ASTERIA_SQLITE_DATABASE_PATH = qualityLabDatabasePath;

  try {
    await runQualityLabCli([topicsPath, '--output', outputPath]);
    await stat(outputPath);
    await stat(qualityLabDatabasePath);
  } finally {
    restoreEnv('ASTERIA_PERSISTENCE_MODE', previousMode);
    restoreEnv('ASTERIA_SQLITE_DATABASE_PATH', previousPath);
  }
});

test('sqlite concurrency rejects stale queue and scheduler revisions', async () => {
  const persistence = createSQLitePersistenceComposition({ databasePath: await createDatabasePath() });
  const setup = await createOperationalSetup(persistence);

  const enqueued = await setup.queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-11T00:00:00.000Z'
  });
  const queueSnapshot = await persistence.publishingQueueRepository.getById(enqueued.item!.id);

  await persistence.publishingQueueRepository.updateStatus(enqueued.item!.id, {
    status: 'SCHEDULED',
    updatedAt: '2026-07-11T00:01:00.000Z',
    expectedRevision: queueSnapshot!.revision
  });

  await assert.rejects(
    () =>
      persistence.publishingQueueRepository.updateStatus(enqueued.item!.id, {
        status: 'PROCESSING',
        updatedAt: '2026-07-11T00:02:00.000Z',
        expectedRevision: queueSnapshot!.revision
      }),
    PersistenceRevisionConflictError
  );

  const scheduled = await persistence.schedulerRepository.create(createScheduledJobFixture('schedule-concurrent', enqueued.item!.id));
  await persistence.schedulerRepository.reschedule(scheduled.value.id, {
    scheduledFor: '2026-07-11T03:00:00.000Z',
    timezone: 'UTC'
  }, {
    expectedRevision: scheduled.revision
  });

  await assert.rejects(
    () =>
      persistence.schedulerRepository.reschedule(scheduled.value.id, {
        scheduledFor: '2026-07-11T04:00:00.000Z',
        timezone: 'UTC'
      }, {
        expectedRevision: scheduled.revision
      }),
    PersistenceRevisionConflictError
  );

  persistence.sqliteConnection.close();
});

test('sqlite execution repository rejects stale execution revisions', async () => {
  const persistence = createSQLitePersistenceComposition({ databasePath: await createDatabasePath() });
  const execution = await persistence.jobExecutionRepository.createExecution({
    id: 'execution-stale',
    jobId: 'schedule-stale',
    queueItemId: 'queue-stale',
    status: 'RUNNING',
    due: true,
    attemptCount: 0,
    retryCount: 0,
    startedAt: '2026-07-11T00:00:00.000Z'
  });

  await persistence.jobExecutionRepository.recordFailure(execution.value.id, {
    code: 'first_failure',
    reason: 'First failure wins.',
    retryable: false
  }, {
    expectedRevision: execution.revision
  });

  await assert.rejects(
    () =>
      persistence.jobExecutionRepository.recordSuccess(execution.value.id, {
        status: 'SUCCEEDED',
        job: createScheduledJobFixture('schedule-stale', 'queue-stale'),
        execution: execution.value,
        due: true,
        attemptCount: 1,
        retryCount: 0,
        message: 'Stale success should not overwrite failure.'
      }, {
        expectedRevision: execution.revision
      }),
    PersistenceRevisionConflictError
  );

  assert.equal((await persistence.jobExecutionRepository.getById(execution.value.id))?.value.status, 'FAILED');
  persistence.sqliteConnection.close();
});

test('scheduler transaction rolls back queue transition when job creation fails', async () => {
  const persistence = createSQLitePersistenceComposition({ databasePath: await createDatabasePath() });
  const setup = await createOperationalSetup(persistence);
  const enqueued = await setup.queue.enqueue({
    publishingPackage: createPackageFixture(),
    approvalResult: createApprovalFixture('APPROVED'),
    destination: createDestination(),
    now: '2026-07-12T00:00:00.000Z'
  });

  await persistence.schedulerRepository.create(createScheduledJobFixture('schedule-1', 'other-queue-item'));

  await assert.rejects(
    () =>
      setup.scheduler.schedule({
        queueItem: enqueued.item!,
        policy: {
          scheduledFor: '2026-07-12T03:00:00.000Z',
          timezone: 'UTC'
        },
        now: '2026-07-12T00:01:00.000Z'
      }),
    /UNIQUE|constraint/i
  );

  assert.equal((await setup.queue.getItem(enqueued.item!.id))?.status, 'APPROVED');
  persistence.sqliteConnection.close();
});

test('executor transaction avoids leaked running execution when queue transition throws', async () => {
  const persistence = createSQLitePersistenceComposition({ databasePath: await createDatabasePath() });
  const job = createScheduledJobFixture('schedule-atomicity', 'queue-atomicity');
  const queueItem = createQueueItemFixture(job.queueItemId, 'SCHEDULED');
  const executor = new ScheduledJobExecutor({
    scheduler: {
      async get(id: string) {
        return id === job.id ? job : null;
      }
    },
    queue: {
      async getItem(id: string) {
        return id === queueItem.id ? queueItem : null;
      },
      async updateStatus() {
        throw new Error('Simulated queue transition failure.');
      },
      async recordFailure() {
        throw new Error('recordFailure should not be called for queue transition throw.');
      },
      async cancelItem() {
        throw new Error('cancelItem should not be called.');
      }
    } as unknown as PublishingQueue,
    repository: persistence.jobExecutionRepository,
    idempotencyStore: persistence.idempotencyStore,
    lockManager: persistence.lockManager,
    unitOfWork: persistence.unitOfWork
  });

  const result = await executor.execute({
    jobId: job.id,
    now: '2026-07-13T00:00:00.000Z',
    operation: () => ({ ok: true })
  });

  assert.equal(result.status, 'SKIPPED');
  assert.equal(result.failure?.reason, 'Simulated queue transition failure.');
  assert.equal(await persistence.lockManager.get(`scheduled-job:${job.id}`), undefined);
  assert.equal(await persistence.idempotencyStore.get(`scheduled-job:${job.id}`, 'scheduled-job-execution'), undefined);
  const executions = (await persistence.jobExecutionRepository.list({ jobId: job.id })).items.map((record) => record.value);
  assert.deepEqual(executions.map((execution) => execution.status), ['SKIPPED']);
  persistence.sqliteConnection.close();
});

interface OperationalMetrics {
  migrationMs: number;
  startupCount: number;
  transactionCount: number;
  rollbackCount: number;
  lockAcquireCount: number;
  retryCount: number;
}

function createOperationalMetrics(): OperationalMetrics {
  return {
    migrationMs: 0,
    startupCount: 1,
    transactionCount: 0,
    rollbackCount: 0,
    lockAcquireCount: 0,
    retryCount: 0
  };
}

function wrapOperationalPersistence(
  persistence: SQLitePersistenceComposition,
  metrics: OperationalMetrics
): SQLitePersistenceComposition {
  return {
    ...persistence,
    lockManager: new CountingLockManager(persistence.lockManager, metrics),
    unitOfWork: new CountingUnitOfWork(persistence.unitOfWork, metrics)
  };
}

class CountingUnitOfWork implements UnitOfWork {
  private readonly inner: UnitOfWork;
  private readonly metrics: OperationalMetrics;

  constructor(inner: UnitOfWork, metrics: OperationalMetrics) {
    this.inner = inner;
    this.metrics = metrics;
  }

  async runInTransaction<T>(callback: (context: TransactionContext) => Promise<T>): Promise<T> {
    this.metrics.transactionCount += 1;

    try {
      return await this.inner.runInTransaction(callback);
    } catch (error) {
      this.metrics.rollbackCount += 1;
      throw error;
    }
  }
}

class CountingLockManager implements LockManager {
  private readonly inner: LockManager;
  private readonly metrics: OperationalMetrics;

  constructor(inner: LockManager, metrics: OperationalMetrics) {
    this.inner = inner;
    this.metrics = metrics;
  }

  async acquire(lockKey: string, owner: string, ttlMs: number, now?: string): Promise<LockToken | undefined> {
    const token = await this.inner.acquire(lockKey, owner, ttlMs, now);

    if (token) {
      this.metrics.lockAcquireCount += 1;
    }

    return token;
  }

  renew(token: LockToken, ttlMs: number, now?: string): Promise<LockToken | undefined> {
    return this.inner.renew(token, ttlMs, now);
  }

  release(token: LockToken): Promise<boolean> {
    return this.inner.release(token);
  }

  get(lockKey: string): Promise<LockToken | undefined> {
    return this.inner.get(lockKey);
  }
}

async function createOperationalSetup(persistence: PersistenceComposition) {
  const queue = new PublishingQueue({
    repository: persistence.publishingQueueRepository
  });
  const scheduler = new SchedulerService({
    repository: persistence.schedulerRepository,
    queue,
    unitOfWork: persistence.unitOfWork
  });
  const executor = new ScheduledJobExecutor({
    repository: persistence.jobExecutionRepository,
    idempotencyStore: persistence.idempotencyStore,
    lockManager: persistence.lockManager,
    queue,
    scheduler,
    unitOfWork: persistence.unitOfWork
  });

  return {
    queue,
    scheduler,
    executor
  };
}

async function createDatabasePath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'asteria-sqlite-operational-'));
  return join(dir, 'asteria.sqlite');
}

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'SQLite Operational Article',
      summary: 'A concise SQLite operational article summary.',
      body: 'This operational article validates durable queue, scheduler, and execution behavior without publishing.',
      slug: 'sqlite-operational-article',
      language: 'en-US',
      createdAt: '2026-07-10T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: [createTag('sqlite'), createTag('operational')]
      }
    },
    summary: {
      text: 'SQLite operational package summary.'
    },
    seo: {
      metaTitle: 'SQLite Operational Article',
      metaDescription: 'A dry-run SEO description for SQLite operational validation.',
      keywords: ['sqlite', 'operational']
    },
    faq: [
      {
        question: 'Does this publish content?',
        answer: 'No. It validates persistence behavior only.'
      }
    ],
    imagePrompt: {
      prompt: 'SQLite operational preview image.'
    },
    productPrompt: {
      prompt: 'SQLite operational preview products.'
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

function createScheduledJobFixture(id: string, queueItemId: string): ScheduledJob {
  return {
    id,
    queueItemId,
    status: 'SCHEDULED',
    policy: {
      scheduledFor: '2026-07-11T02:00:00.000Z',
      timezone: 'UTC'
    },
    scheduledFor: '2026-07-11T02:00:00.000Z',
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z'
  };
}

function createQueueItemFixture(id: string, status: PublishingQueueItem['status']): PublishingQueueItem {
  return {
    id,
    status,
    publishingPackage: createPackageFixture(),
    approvalDecision: 'APPROVED',
    destination: createDestination(),
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
    metadata: {}
  };
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
