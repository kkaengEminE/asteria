import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublishingQueueItem } from '../src/domain/publishingQueue/index.ts';
import type { ScheduledJob, ScheduledJobExecution } from '../src/domain/scheduler/index.ts';
import {
  createPostgreSQLPersistenceComposition,
  migratePostgreSQLDatabase,
  PostgreSQLMigrationError,
  type PostgreSQLConnection,
  type PostgreSQLQueryResult,
  type PostgreSQLRow,
  type PostgreSQLValue
} from '../src/providers/persistence/postgresql/index.ts';
import {
  createInMemoryPersistenceComposition,
  createPersistenceComposition,
  PersistenceRevisionConflictError
} from '../src/services/persistence/index.ts';

test('postgresql migration initializes schema and is repeatable', async () => {
  const connection = new FakePostgreSQLConnection();

  await migratePostgreSQLDatabase(connection);
  await migratePostgreSQLDatabase(connection);

  assert.deepEqual(connection.schemaVersions(), [1]);
});

test('postgresql migration fails on unsupported schema version', async () => {
  const connection = new FakePostgreSQLConnection();
  connection.insertSchemaVersion(999);

  await assert.rejects(
    () => migratePostgreSQLDatabase(connection),
    PostgreSQLMigrationError
  );
});

test('postgresql composition wires operational repositories and leaves observational stores in-memory', async () => {
  const connection = new FakePostgreSQLConnection();
  const persistence = await createPostgreSQLPersistenceComposition({ connection });

  assert.ok(persistence.publishingQueueRepository);
  assert.ok(persistence.schedulerRepository);
  assert.ok(persistence.jobExecutionRepository);
  assert.ok(persistence.idempotencyStore);
  assert.ok(persistence.lockManager);
  assert.ok(persistence.unitOfWork);
  assert.equal(persistence.auditStore.constructor.name, 'InMemoryAuditStore');
  assert.equal(persistence.metricsStore.constructor.name, 'InMemoryMetricsStore');
});

test('postgresql queue repository persists records and rejects stale revisions atomically', async () => {
  const persistence = await createPostgreSQLPersistenceComposition({ connection: new FakePostgreSQLConnection() });
  const created = await persistence.publishingQueueRepository.create(createQueueItem('queue-1'));

  const scheduled = await persistence.publishingQueueRepository.updateStatus('queue-1', {
    status: 'SCHEDULED',
    updatedAt: '2026-07-10T00:01:00.000Z',
    expectedRevision: created.revision
  });

  assert.equal(scheduled.value.status, 'SCHEDULED');
  assert.equal(scheduled.revision, 2);
  assert.equal((await persistence.publishingQueueRepository.findByIdempotencyKey('queue-1:idempotency'))?.value.id, 'queue-1');
  await assert.rejects(
    () =>
      persistence.publishingQueueRepository.updateStatus('queue-1', {
        status: 'PROCESSING',
        updatedAt: '2026-07-10T00:02:00.000Z',
        expectedRevision: created.revision
      }),
    PersistenceRevisionConflictError
  );
});

test('postgresql scheduler repository persists jobs and rejects stale revisions atomically', async () => {
  const persistence = await createPostgreSQLPersistenceComposition({ connection: new FakePostgreSQLConnection() });
  const created = await persistence.schedulerRepository.create(createScheduledJob('job-1', 'queue-1'));

  const rescheduled = await persistence.schedulerRepository.reschedule('job-1', {
    scheduledFor: '2026-07-10T00:10:00.000Z',
    timezone: 'UTC'
  }, {
    expectedRevision: created.revision
  });

  assert.equal(rescheduled.value.scheduledFor, '2026-07-10T00:10:00.000Z');
  assert.equal((await persistence.schedulerRepository.findActiveByQueueItemId('queue-1'))?.value.id, 'job-1');
  await assert.rejects(
    () =>
      persistence.schedulerRepository.cancel('job-1', 'stale cancel', {
        expectedRevision: created.revision
      }),
    PersistenceRevisionConflictError
  );
});

test('postgresql job execution repository persists execution records and rejects stale revisions atomically', async () => {
  const persistence = await createPostgreSQLPersistenceComposition({ connection: new FakePostgreSQLConnection() });
  const created = await persistence.jobExecutionRepository.createExecution(createExecution('execution-1', 'job-1'));

  const success = await persistence.jobExecutionRepository.recordSuccess('execution-1', {
    status: 'SUCCEEDED',
    due: true,
    attemptCount: 1,
    retryCount: 0,
    value: {
      message: 'preview only'
    },
    message: 'Preview execution succeeded.'
  }, {
    expectedRevision: created.revision
  });

  assert.equal(success.value.status, 'SUCCEEDED');
  assert.equal((await persistence.jobExecutionRepository.findActiveByJobId('job-1'))?.value.id, 'execution-1');
  await assert.rejects(
    () =>
      persistence.jobExecutionRepository.recordSkipped('execution-1', 'stale skip', {
        expectedRevision: created.revision
      }),
    PersistenceRevisionConflictError
  );
});

test('postgresql idempotency records persist claim completion and failure', async () => {
  const persistence = await createPostgreSQLPersistenceComposition({ connection: new FakePostgreSQLConnection() });

  await persistence.idempotencyStore.claim('key-1', 'scope-1', { topic: 'cats' });
  await persistence.idempotencyStore.complete('key-1', 'scope-1', 'result-1');
  await persistence.idempotencyStore.claim('key-2', 'scope-1');
  await persistence.idempotencyStore.fail('key-2', 'scope-1', {
    reason: 'failed on purpose',
    code: 'test_failure',
    retryable: true
  });

  assert.equal((await persistence.idempotencyStore.get('key-1', 'scope-1'))?.status, 'COMPLETED');
  assert.equal((await persistence.idempotencyStore.get('key-1', 'scope-1'))?.resultReference, 'result-1');
  assert.equal((await persistence.idempotencyStore.get('key-2', 'scope-1'))?.failure?.code, 'test_failure');
});

test('postgresql locks support ttl expiry renew and release', async () => {
  const persistence = await createPostgreSQLPersistenceComposition({ connection: new FakePostgreSQLConnection() });
  const acquired = await persistence.lockManager.acquire('lock-1', 'owner-1', 1000, '2099-07-10T00:00:00.000Z');

  assert.ok(acquired);
  assert.equal(await persistence.lockManager.acquire('lock-1', 'owner-2', 1000, '2099-07-10T00:00:00.500Z'), undefined);

  const renewed = await persistence.lockManager.renew(acquired!, 1000, '2099-07-10T00:00:00.800Z');

  assert.equal(renewed?.expiresAt, '2099-07-10T00:00:01.800Z');
  assert.equal(await persistence.lockManager.release(renewed!), true);
  assert.equal(await persistence.lockManager.get('lock-1'), undefined);

  const expired = await persistence.lockManager.acquire('lock-1', 'owner-3', 1000, '2099-07-10T00:00:00.000Z');
  assert.ok(expired);
  assert.ok(await persistence.lockManager.acquire('lock-1', 'owner-4', 1000, '2099-07-10T00:00:02.000Z'));
});

test('postgresql unit of work rolls back operational writes', async () => {
  const connection = new FakePostgreSQLConnection();
  const persistence = await createPostgreSQLPersistenceComposition({ connection });

  await assert.rejects(
    () =>
      persistence.unitOfWork.runInTransaction(async () => {
        await persistence.publishingQueueRepository.create(createQueueItem('queue-1'));
        await persistence.schedulerRepository.create(createScheduledJob('job-1', 'queue-1'));
        throw new Error('rollback postgresql transaction');
      }),
    /rollback postgresql transaction/
  );

  assert.equal(await persistence.publishingQueueRepository.getById('queue-1'), undefined);
  assert.equal(await persistence.schedulerRepository.getById('job-1'), undefined);
  assert.equal(connection.rollbackCount, 1);
});

test('runtime persistence composition keeps memory default and requires explicit postgresql composition', async () => {
  assert.deepEqual(Object.keys(createInMemoryPersistenceComposition()).includes('publishingQueueRepository'), true);
  assert.ok(createPersistenceComposition().publishingQueueRepository);
  assert.throws(
    () => createPersistenceComposition({ mode: 'postgresql' }),
    /PostgreSQL persistence composition requires/
  );

  const postgreSQLComposition = await createPostgreSQLPersistenceComposition({ connection: new FakePostgreSQLConnection() });
  assert.equal(
    createPersistenceComposition({
      mode: 'postgresql',
      postgreSQLComposition
    }),
    postgreSQLComposition
  );
});

class FakePostgreSQLConnection implements PostgreSQLConnection {
  rollbackCount = 0;
  transactionCount = 0;
  private tables = createTables();

  async query<Row extends PostgreSQLRow = PostgreSQLRow>(
    sql: string,
    values: readonly PostgreSQLValue[] = []
  ): Promise<PostgreSQLQueryResult<Row>> {
    const normalized = normalizeSql(sql);

    if (normalized.startsWith('create table')) {
      return result();
    }

    if (normalized.startsWith('select version from schema_migrations')) {
      return result(this.schemaVersions().map((version) => asRow<Row>({ version })));
    }

    if (normalized.startsWith('insert into schema_migrations')) {
      this.insertSchemaVersion(Number(values[0]));
      return result();
    }

    if (normalized.startsWith('insert into publishing_queue_items')) {
      const [id, status, destinationType, magazineSlug, idempotencyKey, dataJson, revision, createdAt, updatedAt] = values;
      this.tables.queue.set(String(id), {
        id,
        status,
        destination_type: destinationType,
        magazine_slug: magazineSlug,
        idempotency_key: idempotencyKey,
        data_json: dataJson,
        revision,
        created_at: createdAt,
        updated_at: updatedAt
      });
      return result();
    }

    if (normalized.startsWith('select data_json, revision from publishing_queue_items where idempotency_key')) {
      return result(findRows(this.tables.queue, (row) => row.idempotency_key === values[0]) as Row[]);
    }

    if (normalized.startsWith('select data_json, revision from publishing_queue_items where id')) {
      return single(this.tables.queue.get(String(values[0])) as Row | undefined);
    }

    if (normalized.startsWith('select data_json, revision from publishing_queue_items order')) {
      return result([...this.tables.queue.values()] as Row[]);
    }

    if (normalized.startsWith('select revision from publishing_queue_items where id')) {
      const row = this.tables.queue.get(String(values[0]));
      return single(row ? asRow<Row>({ revision: row.revision }) : undefined);
    }

    if (normalized.startsWith('update publishing_queue_items')) {
      const id = String(values[6]);
      const expectedRevision = Number(values[7]);
      const row = this.tables.queue.get(id);
      if (!row || Number(row.revision) !== expectedRevision) {
        return result();
      }
      Object.assign(row, {
        status: values[0],
        destination_type: values[1],
        magazine_slug: values[2],
        idempotency_key: values[3],
        data_json: values[4],
        updated_at: values[5],
        revision: expectedRevision + 1
      });
      return single(asRow<Row>({ data_json: row.data_json, revision: row.revision }));
    }

    if (normalized.startsWith('insert into scheduled_jobs')) {
      const [id, queueItemId, status, scheduledFor, dataJson, revision, createdAt, updatedAt] = values;
      this.tables.jobs.set(String(id), {
        id,
        queue_item_id: queueItemId,
        status,
        scheduled_for: scheduledFor,
        data_json: dataJson,
        revision,
        created_at: createdAt,
        updated_at: updatedAt
      });
      return result();
    }

    if (normalized.startsWith('select data_json, revision from scheduled_jobs where id')) {
      return single(this.tables.jobs.get(String(values[0])) as Row | undefined);
    }

    if (normalized.startsWith('select data_json, revision from scheduled_jobs where queue_item_id')) {
      return result(findRows(this.tables.jobs, (row) => row.queue_item_id === values[0] && ['SCHEDULED', 'RETRY_PENDING'].includes(String(row.status))) as Row[]);
    }

    if (normalized.startsWith('select data_json, revision from scheduled_jobs order')) {
      return result([...this.tables.jobs.values()] as Row[]);
    }

    if (normalized.startsWith('select revision from scheduled_jobs where id')) {
      const row = this.tables.jobs.get(String(values[0]));
      return single(row ? asRow<Row>({ revision: row.revision }) : undefined);
    }

    if (normalized.startsWith('update scheduled_jobs')) {
      const id = String(values[5]);
      const expectedRevision = Number(values[6]);
      const row = this.tables.jobs.get(id);
      if (!row || Number(row.revision) !== expectedRevision) {
        return result();
      }
      Object.assign(row, {
        queue_item_id: values[0],
        status: values[1],
        scheduled_for: values[2],
        data_json: values[3],
        updated_at: values[4],
        revision: expectedRevision + 1
      });
      return single(asRow<Row>({ data_json: row.data_json, revision: row.revision }));
    }

    if (normalized.startsWith('insert into job_executions')) {
      const [id, jobId, queueItemId, status, dataJson, revision, startedAt, completedAt] = values;
      this.tables.executions.set(String(id), {
        id,
        job_id: jobId,
        queue_item_id: queueItemId,
        status,
        data_json: dataJson,
        revision,
        started_at: startedAt,
        completed_at: completedAt
      });
      return result();
    }

    if (normalized.startsWith('select data_json, revision from job_executions where id')) {
      return single(this.tables.executions.get(String(values[0])) as Row | undefined);
    }

    if (normalized.startsWith('select data_json, revision from job_executions where job_id')) {
      return result(findRows(this.tables.executions, (row) => row.job_id === values[0] && ['RUNNING', 'SUCCEEDED'].includes(String(row.status))) as Row[]);
    }

    if (normalized.startsWith('select data_json, revision from job_executions order')) {
      return result([...this.tables.executions.values()] as Row[]);
    }

    if (normalized.startsWith('select revision from job_executions where id')) {
      const row = this.tables.executions.get(String(values[0]));
      return single(row ? asRow<Row>({ revision: row.revision }) : undefined);
    }

    if (normalized.startsWith('update job_executions')) {
      const id = String(values[6]);
      const expectedRevision = Number(values[7]);
      const row = this.tables.executions.get(id);
      if (!row || Number(row.revision) !== expectedRevision) {
        return result();
      }
      Object.assign(row, {
        job_id: values[0],
        queue_item_id: values[1],
        status: values[2],
        data_json: values[3],
        started_at: values[4],
        completed_at: values[5],
        revision: expectedRevision + 1
      });
      return single(asRow<Row>({ data_json: row.data_json, revision: row.revision }));
    }

    if (normalized.startsWith('insert into idempotency_records')) {
      const [scope, key, status, resultReference, failureJson, metadataJson, createdAt, updatedAt] = values;
      const id = `${scope}:${key}`;
      if (!this.tables.idempotency.has(id)) {
        this.tables.idempotency.set(id, {
          scope,
          key,
          status,
          result_reference: resultReference,
          failure_json: failureJson,
          metadata_json: metadataJson,
          created_at: createdAt,
          updated_at: updatedAt
        });
      }
      return result();
    }

    if (normalized.startsWith('update idempotency_records set status =')) {
      const id = `${values[2]}:${values[3]}`;
      const row = this.tables.idempotency.get(id);
      if (row) {
        row.status = normalized.includes("'completed'") ? 'COMPLETED' : 'FAILED';
        row.updated_at = values[1];
        if (row.status === 'COMPLETED') {
          row.result_reference = values[0];
          row.failure_json = null;
        } else {
          row.failure_json = values[0];
        }
      }
      return result();
    }

    if (normalized.startsWith('select * from idempotency_records')) {
      return single(this.tables.idempotency.get(`${values[0]}:${values[1]}`) as Row | undefined);
    }

    if (normalized.startsWith('insert into execution_locks')) {
      const [key, owner, token, acquiredAt, expiresAt, metadataJson, updatedAt, now] = values;
      const id = String(key);
      const existing = this.tables.locks.get(id);
      if (!existing || Date.parse(String(existing.expires_at)) <= Date.parse(String(now))) {
        const row = {
          key,
          owner,
          token,
          acquired_at: acquiredAt,
          expires_at: expiresAt,
          metadata_json: metadataJson,
          updated_at: updatedAt
        };
        this.tables.locks.set(id, row);
        return single(asRow<Row>(row));
      }
      return result();
    }

    if (normalized.startsWith('update execution_locks')) {
      const row = this.tables.locks.get(String(values[2]));
      if (row && row.token === values[3]) {
        row.expires_at = values[0];
        row.updated_at = values[1];
        return single(row as Row);
      }
      return result();
    }

    if (normalized.startsWith('delete from execution_locks')) {
      const row = this.tables.locks.get(String(values[0]));
      if (row && row.token === values[1]) {
        this.tables.locks.delete(String(values[0]));
        return { rows: [], rowCount: 1 };
      }
      return result();
    }

    if (normalized.startsWith('select * from execution_locks')) {
      return single(this.tables.locks.get(String(values[0])) as Row | undefined);
    }

    throw new Error(`Unhandled fake PostgreSQL query: ${normalized}`);
  }

  async transaction<T>(callback: (connection: PostgreSQLConnection) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const snapshot = cloneTables(this.tables);

    try {
      return await callback(this);
    } catch (error) {
      this.tables = snapshot;
      this.rollbackCount += 1;
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  schemaVersions(): number[] {
    return [...this.tables.migrations.keys()].sort((left, right) => left - right);
  }

  insertSchemaVersion(version: number): void {
    this.tables.migrations.set(version, {
      version,
      applied_at: '2026-07-10T00:00:00.000Z'
    });
  }
}

interface FakeTables {
  migrations: Map<number, PostgreSQLRow>;
  queue: Map<string, PostgreSQLRow>;
  jobs: Map<string, PostgreSQLRow>;
  executions: Map<string, PostgreSQLRow>;
  idempotency: Map<string, PostgreSQLRow>;
  locks: Map<string, PostgreSQLRow>;
}

function createTables(): FakeTables {
  return {
    migrations: new Map(),
    queue: new Map(),
    jobs: new Map(),
    executions: new Map(),
    idempotency: new Map(),
    locks: new Map()
  };
}

function cloneTables(tables: FakeTables): FakeTables {
  return {
    migrations: cloneMap(tables.migrations),
    queue: cloneMap(tables.queue),
    jobs: cloneMap(tables.jobs),
    executions: cloneMap(tables.executions),
    idempotency: cloneMap(tables.idempotency),
    locks: cloneMap(tables.locks)
  };
}

function cloneMap<Key>(source: Map<Key, PostgreSQLRow>): Map<Key, PostgreSQLRow> {
  return new Map([...source.entries()].map(([key, value]) => [key, { ...value }]));
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function result<Row extends PostgreSQLRow = PostgreSQLRow>(rows: Row[] = []): PostgreSQLQueryResult<Row> {
  return {
    rows,
    rowCount: rows.length
  };
}

function single<Row extends PostgreSQLRow = PostgreSQLRow>(row: Row | undefined): PostgreSQLQueryResult<Row> {
  return row ? result([row]) : result();
}

function findRows(source: Map<string, PostgreSQLRow>, predicate: (row: PostgreSQLRow) => boolean): PostgreSQLRow[] {
  return [...source.values()].filter(predicate);
}

function asRow<Row extends PostgreSQLRow>(row: PostgreSQLRow): Row {
  return row as unknown as Row;
}

function createQueueItem(id: string, status: PublishingQueueItem['status'] = 'APPROVED'): PublishingQueueItem {
  return {
    id,
    status,
    publishingPackage: {
      article: {
        title: 'PostgreSQL Cat Article',
        summary: 'A concise PostgreSQL cat article summary.',
        body: 'This PostgreSQL cat article verifies durable adapter boundaries without publishing.',
        slug: 'postgresql-cat-article',
        language: 'en-US',
        createdAt: '2026-07-10T00:00:00.000Z',
        metadata: {
          status: 'draft',
          tags: [
            { name: 'cat', slug: 'cat' },
            { name: 'postgresql', slug: 'postgresql' }
          ]
        }
      },
      summary: {
        text: 'PostgreSQL package summary.'
      },
      seo: {
        metaTitle: 'PostgreSQL Cat Article',
        metaDescription: 'A dry-run SEO description for a PostgreSQL cat article.',
        keywords: ['cat', 'postgresql']
      },
      faq: [
        {
          question: 'Is this published?',
          answer: 'No. This is a persistence adapter test.'
        }
      ],
      imagePrompt: {
        prompt: 'Cat PostgreSQL preview image.'
      },
      productPrompt: {
        prompt: 'Cat PostgreSQL preview products.'
      },
      metadata: {}
    },
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
