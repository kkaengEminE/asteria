import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { after, before, test } from 'node:test';
import { createPublishingPackage, createTag, type PublishingPackage } from '../../src/domain/content/index.ts';
import type { PublishingQueueItem } from '../../src/domain/publishingQueue/index.ts';
import type { ScheduledJob, ScheduledJobExecution } from '../../src/domain/scheduler/index.ts';
import { runMagazineDryRun } from '../../src/magazines/runtime/index.ts';
import {
  createPostgreSQLPersistenceComposition,
  createPostgreSQLPersistenceConfigFromEnv,
  createPostgreSQLPoolConnection,
  migratePostgreSQLDatabase,
  type PostgreSQLPoolConnection
} from '../../src/providers/persistence/postgresql/index.ts';
import {
  PersistenceRevisionConflictError,
  type PersistenceComposition
} from '../../src/services/persistence/index.ts';

const execFileAsync = promisify(execFile);
const POSTGRESQL_IMAGE = 'postgres:16.6-alpine';
const CONTAINER_NAME = `asteria-pg-${process.pid}-${Date.now()}`;
const POSTGRES_USER = 'asteria';
const POSTGRES_PASSWORD = 'asteria_test_password';
const POSTGRES_DB = 'asteria';

interface PostgreSQLTestEnvironment {
  url: string;
  containerName: string;
  startupMs: number;
}

const diagnostics = {
  dockerAvailable: false,
  image: POSTGRESQL_IMAGE,
  startupMs: 0,
  migrationMs: 0,
  transactionCommitCount: 0,
  rollbackCount: 0,
  concurrentConflictCount: 0,
  lockAcquisitionCount: 0,
  lockConflictCount: 0
};

const dockerStatus = await detectDockerAndImage();
let environment: PostgreSQLTestEnvironment | undefined;

if (dockerStatus.available) {
  before(async () => {
    environment = await startPostgreSQLContainer();
    diagnostics.dockerAvailable = true;
    diagnostics.startupMs = environment.startupMs;
  });

  after(async () => {
    if (environment) {
      await docker(['stop', environment.containerName], {
        allowFailure: true
      });
    }

    console.log(`PostgreSQL integration diagnostics: ${JSON.stringify(diagnostics)}`);
  });
}

test('postgresql real database integration environment is available', {
  skip: dockerStatus.available ? false : dockerStatus.reason
}, async () => {
  assert.ok(environment?.url);
  assert.equal(diagnostics.image, POSTGRESQL_IMAGE);
});

test('postgresql migrations bootstrap repeat and restart against existing database', {
  skip: dockerStatus.available ? false : dockerStatus.reason
}, async () => {
  const first = await createRealPersistence();
  const migrationStart = Date.now();
  await migratePostgreSQLDatabase(first.connection);
  diagnostics.migrationMs += Date.now() - migrationStart;

  const versions = await first.connection.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version ASC');
  assert.deepEqual(versions.rows.map((row) => Number(row.version)), [1]);
  await first.connection.close();

  const second = await createRealPersistence();
  const repeated = await second.connection.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version ASC');
  assert.deepEqual(repeated.rows.map((row) => Number(row.version)), [1]);
  await second.connection.close();
});

test('postgresql migrations fail on unsupported future schema version', {
  skip: dockerStatus.available ? false : dockerStatus.reason
}, async () => {
  const databaseName = `asteria_unsupported_${Date.now()}`;
  const admin = createConnection(environment!.url);

  await admin.query(`CREATE DATABASE ${databaseName}`);
  await admin.close();

  const url = replaceDatabaseName(environment!.url, databaseName);
  const connection = createConnection(url);

  try {
    await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)');
    await connection.query('INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)', [999, new Date().toISOString()]);
    await assert.rejects(
      () => migratePostgreSQLDatabase(connection),
      /Unsupported PostgreSQL schema version 999/
    );
  } finally {
    await connection.close();
    const cleanup = createConnection(environment!.url);
    await cleanup.query(`DROP DATABASE ${databaseName} WITH (FORCE)`);
    await cleanup.close();
  }
});

test('postgresql repositories persist queue scheduler and execution records across pool recreation', {
  skip: dockerStatus.available ? false : dockerStatus.reason
}, async () => {
  const first = await createRealPersistence();
  const id = uniqueId('repo');
  const queue = await first.persistence.publishingQueueRepository.create(createQueueItem(`${id}-queue`));
  const updatedQueue = await first.persistence.publishingQueueRepository.updateStatus(queue.value.id, {
    status: 'SCHEDULED',
    updatedAt: '2026-07-10T00:01:00.000Z',
    expectedRevision: queue.revision
  });
  const job = await first.persistence.schedulerRepository.create(createScheduledJob(`${id}-job`, queue.value.id));
  const rescheduled = await first.persistence.schedulerRepository.reschedule(job.value.id, {
    scheduledFor: '2026-07-10T00:10:00.000Z',
    timezone: 'UTC'
  }, {
    expectedRevision: job.revision
  });
  const execution = await first.persistence.jobExecutionRepository.createExecution(createExecution(`${id}-execution`, job.value.id, queue.value.id));
  await first.persistence.jobExecutionRepository.recordSuccess(execution.value.id, {
    status: 'SUCCEEDED',
    due: true,
    attemptCount: 1,
    retryCount: 0,
    message: 'Real database execution succeeded.'
  }, {
    expectedRevision: execution.revision
  });
  await first.connection.close();

  const second = await createRealPersistence();

  assert.equal((await second.persistence.publishingQueueRepository.getById(queue.value.id))?.value.status, updatedQueue.value.status);
  assert.equal((await second.persistence.schedulerRepository.getById(job.value.id))?.value.scheduledFor, rescheduled.value.scheduledFor);
  assert.equal((await second.persistence.jobExecutionRepository.getById(execution.value.id))?.value.status, 'SUCCEEDED');

  const listedQueues = await second.persistence.publishingQueueRepository.list({ limit: 1 });
  assert.equal(listedQueues.items.length, 1);
  assert.ok(listedQueues.nextCursor);
  await second.connection.close();
});

test('postgresql real concurrent revision updates allow only one winner', {
  skip: dockerStatus.available ? false : dockerStatus.reason
}, async () => {
  const { persistence, connection } = await createRealPersistence();
  const id = uniqueId('conflict');
  const queue = await persistence.publishingQueueRepository.create(createQueueItem(`${id}-queue`));

  const queueResults = await Promise.allSettled([
    persistence.publishingQueueRepository.updateStatus(queue.value.id, {
      status: 'SCHEDULED',
      updatedAt: '2026-07-10T00:01:00.000Z',
      expectedRevision: queue.revision
    }),
    persistence.publishingQueueRepository.updateStatus(queue.value.id, {
      status: 'PROCESSING',
      updatedAt: '2026-07-10T00:02:00.000Z',
      expectedRevision: queue.revision
    })
  ]);
  assertOneRevisionConflict(queueResults);

  const job = await persistence.schedulerRepository.create(createScheduledJob(`${id}-job`, queue.value.id));
  const schedulerResults = await Promise.allSettled([
    persistence.schedulerRepository.reschedule(job.value.id, {
      scheduledFor: '2026-07-10T00:20:00.000Z',
      timezone: 'UTC'
    }, {
      expectedRevision: job.revision
    }),
    persistence.schedulerRepository.cancel(job.value.id, 'concurrent cancel', {
      expectedRevision: job.revision
    })
  ]);
  assertOneRevisionConflict(schedulerResults);

  const execution = await persistence.jobExecutionRepository.createExecution(createExecution(`${id}-execution`, job.value.id, queue.value.id));
  const executionResults = await Promise.allSettled([
    persistence.jobExecutionRepository.recordSuccess(execution.value.id, {
      status: 'SUCCEEDED',
      due: true,
      attemptCount: 1,
      retryCount: 0,
      message: 'success'
    }, {
      expectedRevision: execution.revision
    }),
    persistence.jobExecutionRepository.recordSkipped(execution.value.id, 'concurrent skip', {
      expectedRevision: execution.revision
    })
  ]);
  assertOneRevisionConflict(executionResults);
  await connection.close();
});

test('postgresql unit of work commits and rolls back multi-repository operations', {
  skip: dockerStatus.available ? false : dockerStatus.reason
}, async () => {
  const { persistence, connection } = await createRealPersistence();
  const id = uniqueId('uow');
  const queue = await persistence.publishingQueueRepository.create(createQueueItem(`${id}-queue`));

  await persistence.unitOfWork.runInTransaction(async () => {
    diagnostics.transactionCommitCount += 1;
    await persistence.publishingQueueRepository.updateStatus(queue.value.id, {
      status: 'SCHEDULED',
      updatedAt: '2026-07-10T00:01:00.000Z',
      expectedRevision: queue.revision
    });
    await persistence.schedulerRepository.create(createScheduledJob(`${id}-job`, queue.value.id));
  });

  assert.equal((await persistence.publishingQueueRepository.getById(queue.value.id))?.value.status, 'SCHEDULED');
  assert.equal((await persistence.schedulerRepository.getById(`${id}-job`))?.value.queueItemId, queue.value.id);

  const rollbackQueue = await persistence.publishingQueueRepository.create(createQueueItem(`${id}-rollback-queue`, 'SCHEDULED'));
  await assert.rejects(
    () =>
      persistence.unitOfWork.runInTransaction(async () => {
        diagnostics.rollbackCount += 1;
        await persistence.publishingQueueRepository.updateStatus(rollbackQueue.value.id, {
          status: 'PROCESSING',
          updatedAt: '2026-07-10T00:02:00.000Z',
          expectedRevision: rollbackQueue.revision
        });
        await persistence.jobExecutionRepository.createExecution(createExecution(`${id}-rollback-execution`, `${id}-job`, rollbackQueue.value.id));
        throw new Error('rollback real transaction');
      }),
    /rollback real transaction/
  );

  assert.equal((await persistence.publishingQueueRepository.getById(rollbackQueue.value.id))?.value.status, 'SCHEDULED');
  assert.equal(await persistence.jobExecutionRepository.getById(`${id}-rollback-execution`), undefined);
  await assert.doesNotReject(() => persistence.unitOfWork.runInTransaction(async () =>
    persistence.unitOfWork.runInTransaction(async () => undefined)
  ));
  await connection.close();
});

test('postgresql idempotency persists states and supports current failed retry semantics', {
  skip: dockerStatus.available ? false : dockerStatus.reason
}, async () => {
  const first = await createRealPersistence();
  const id = uniqueId('idem');

  const claim = await first.persistence.idempotencyStore.claim(`${id}-key`, 'scope', { id });
  const duplicate = await first.persistence.idempotencyStore.claim(`${id}-key`, 'scope', { duplicate: true });
  assert.equal(duplicate.status, claim.status);

  await first.persistence.idempotencyStore.complete(`${id}-key`, 'scope', 'result-1');
  await first.persistence.idempotencyStore.claim(`${id}-failed`, 'scope');
  await first.persistence.idempotencyStore.fail(`${id}-failed`, 'scope', {
    reason: 'failed once',
    code: 'failed_once',
    retryable: true
  });
  const retry = await first.persistence.idempotencyStore.claim(`${id}-failed`, 'scope');
  assert.equal(retry.status, 'FAILED');
  await first.connection.close();

  const second = await createRealPersistence();
  assert.equal((await second.persistence.idempotencyStore.get(`${id}-key`, 'scope'))?.status, 'COMPLETED');
  assert.equal((await second.persistence.idempotencyStore.get(`${id}-failed`, 'scope'))?.failure?.code, 'failed_once');
  await second.connection.close();
});

test('postgresql locks persist across pooled connections and allow only one concurrent owner', {
  skip: dockerStatus.available ? false : dockerStatus.reason
}, async () => {
  const first = await createRealPersistence();
  const second = await createRealPersistence();
  const key = uniqueId('lock');

  const acquired = await first.persistence.lockManager.acquire(key, 'owner-1', 1000, '2099-07-10T00:00:00.000Z');
  diagnostics.lockAcquisitionCount += acquired ? 1 : 0;
  assert.ok(acquired);
  assert.equal(await second.persistence.lockManager.acquire(key, 'owner-2', 1000, '2099-07-10T00:00:00.500Z'), undefined);
  diagnostics.lockConflictCount += 1;

  const renewed = await second.persistence.lockManager.renew(acquired!, 1000, '2099-07-10T00:00:00.800Z');
  assert.equal(renewed?.expiresAt, '2099-07-10T00:00:01.800Z');
  assert.equal(await first.persistence.lockManager.release(renewed!), true);

  const expired = await first.persistence.lockManager.acquire(key, 'owner-3', 1000, '2099-07-10T00:00:00.000Z');
  assert.ok(expired);
  const concurrent = await Promise.all([
    first.persistence.lockManager.acquire(`${key}-concurrent`, 'owner-a', 1000, '2099-07-10T00:00:00.000Z'),
    second.persistence.lockManager.acquire(`${key}-concurrent`, 'owner-b', 1000, '2099-07-10T00:00:00.000Z')
  ]);
  assert.equal(concurrent.filter(Boolean).length, 1);
  await first.connection.close();
  await second.connection.close();
});

test('postgresql runtime dry-run starts migrates health checks and closes gracefully', {
  skip: dockerStatus.available ? false : dockerStatus.reason
}, async () => {
  const connection = createConnection(environment!.url);
  assert.equal(await connection.healthCheck(), true);
  await connection.close();
  await connection.close();

  const result = await runMagazineDryRun({
    persistenceEnv: {
      ASTERIA_PERSISTENCE_MODE: 'postgresql',
      ASTERIA_POSTGRESQL_URL: environment!.url
    }
  });

  assert.equal(result.workflowStatus, 'success');
});

test('postgresql failures redact credentials and reject pool use after close', {
  skip: dockerStatus.available ? false : dockerStatus.reason
}, async () => {
  const badPasswordUrl = environment!.url.replace(POSTGRES_PASSWORD, 'wrong_secret_password');
  const badPassword = createConnection(badPasswordUrl);
  await assert.rejects(
    () => badPassword.healthCheck(),
    (error) => error instanceof Error && !error.message.includes('wrong_secret_password') && !error.message.includes(POSTGRES_PASSWORD)
  );
  await badPassword.close();

  const closed = createConnection(environment!.url);
  await closed.close();
  await assert.rejects(
    () => closed.query('SELECT 1'),
    /already closed/
  );
});

async function createRealPersistence(url = environment!.url): Promise<{
  connection: PostgreSQLPoolConnection;
  persistence: PersistenceComposition;
}> {
  const connection = createConnection(url);
  const migrationStart = Date.now();
  const persistence = await createPostgreSQLPersistenceComposition({
    connection
  });
  diagnostics.migrationMs += Date.now() - migrationStart;
  return {
    connection,
    persistence
  };
}

function createConnection(url: string): PostgreSQLPoolConnection {
  const config = createPostgreSQLPersistenceConfigFromEnv({
    ASTERIA_PERSISTENCE_MODE: 'postgresql',
    ASTERIA_POSTGRESQL_URL: url,
    ASTERIA_POSTGRESQL_POOL_MAX: '4',
    ASTERIA_POSTGRESQL_CONNECTION_TIMEOUT_MS: '5000',
    ASTERIA_POSTGRESQL_IDLE_TIMEOUT_MS: '5000'
  });
  return createPostgreSQLPoolConnection(config);
}

function assertOneRevisionConflict(results: Array<PromiseSettledResult<unknown>>): void {
  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter((result) => result.status === 'rejected') as Array<PromiseRejectedResult>;

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason instanceof PersistenceRevisionConflictError);
  diagnostics.concurrentConflictCount += 1;
}

async function detectDockerAndImage(): Promise<{ available: boolean; reason?: string }> {
  try {
    await docker(['info']);
  } catch (error) {
    return {
      available: false,
      reason: `Docker is unavailable: ${describeCommandError(error)}`
    };
  }

  try {
    await docker(['image', 'inspect', POSTGRESQL_IMAGE]);
    return { available: true };
  } catch {
    try {
      await docker(['pull', POSTGRESQL_IMAGE], {
        timeoutMs: 120000
      });
      return { available: true };
    } catch (error) {
      return {
        available: false,
        reason: `PostgreSQL image ${POSTGRESQL_IMAGE} is unavailable: ${describeCommandError(error)}`
      };
    }
  }
}

async function startPostgreSQLContainer(): Promise<PostgreSQLTestEnvironment> {
  const startedAt = Date.now();
  await docker([
    'run',
    '--detach',
    '--rm',
    '--name',
    CONTAINER_NAME,
    '--env',
    `POSTGRES_USER=${POSTGRES_USER}`,
    '--env',
    `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
    '--env',
    `POSTGRES_DB=${POSTGRES_DB}`,
    '--publish',
    '127.0.0.1::5432',
    POSTGRESQL_IMAGE
  ]);

  const portOutput = await docker(['port', CONTAINER_NAME, '5432/tcp']);
  const port = parseMappedPort(portOutput.stdout);
  const url = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${port}/${POSTGRES_DB}`;
  await waitForPostgreSQL(url);

  return {
    url,
    containerName: CONTAINER_NAME,
    startupMs: Date.now() - startedAt
  };
}

async function waitForPostgreSQL(url: string): Promise<void> {
  const deadline = Date.now() + 45000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const connection = createConnection(url);

    try {
      await connection.healthCheck();
      await connection.close();
      return;
    } catch (error) {
      lastError = error;
      await connection.close().catch(() => undefined);
      await delay(500);
    }
  }

  throw new Error(`PostgreSQL container did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function docker(args: string[], options: { allowFailure?: boolean; timeoutMs?: number } = {}) {
  try {
    return await execFileAsync('docker', args, {
      timeout: options.timeoutMs ?? 30000
    });
  } catch (error) {
    if (options.allowFailure) {
      return {
        stdout: '',
        stderr: describeCommandError(error)
      };
    }
    throw error;
  }
}

function parseMappedPort(output: string): string {
  const match = output.match(/:(\d+)/);

  if (!match) {
    throw new Error(`Could not parse mapped PostgreSQL port from Docker output: ${output}`);
  }

  return match[1];
}

function describeCommandError(error: unknown): string {
  const candidate = error as Error & { stderr?: string; stdout?: string };
  return candidate.stderr || candidate.stdout || candidate.message || String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function replaceDatabaseName(url: string, databaseName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createQueueItem(id: string, status: PublishingQueueItem['status'] = 'APPROVED'): PublishingQueueItem {
  return {
    id,
    status,
    publishingPackage: createPackageFixture(),
    destination: {
      type: 'wordpress',
      name: 'WordPress Preview',
      enabled: false,
      dryRunOnly: true
    },
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
    policy: {
      scheduledFor: '2026-07-10T00:05:00.000Z',
      timezone: 'UTC'
    },
    scheduledFor: '2026-07-10T00:05:00.000Z',
    createdAt: '2026-07-10T00:01:00.000Z',
    updatedAt: '2026-07-10T00:01:00.000Z'
  };
}

function createExecution(id: string, jobId: string, queueItemId: string): ScheduledJobExecution {
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

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'PostgreSQL Real Database Article',
      summary: 'A concise PostgreSQL real database article summary.',
      body: 'This PostgreSQL article verifies real database operational persistence without publishing.',
      slug: 'postgresql-real-database-article',
      language: 'en-US',
      createdAt: '2026-07-10T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: [createTag('cat'), createTag('postgresql')]
      }
    },
    summary: {
      text: 'PostgreSQL real database package summary.'
    },
    seo: {
      metaTitle: 'PostgreSQL Real Database Article',
      metaDescription: 'A dry-run SEO description for a PostgreSQL real database article.',
      keywords: ['cat', 'postgresql']
    },
    faq: [
      {
        question: 'Is this published?',
        answer: 'No. This is a real database validation test.'
      }
    ],
    imagePrompt: {
      prompt: 'Cat PostgreSQL real database preview image.'
    },
    productPrompt: {
      prompt: 'Cat PostgreSQL real database preview products.'
    }
  });
}
