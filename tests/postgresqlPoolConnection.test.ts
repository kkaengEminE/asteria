import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPoolOptions,
  createPostgreSQLPersistenceConfigFromEnv,
  createPostgreSQLPoolConnection,
  PostgreSQLDriverError,
  PostgreSQLPoolConnection,
  redactPostgreSQLDriverError,
  type PostgreSQLPoolClientLike,
  type PostgreSQLPoolLike,
  type PostgreSQLPoolOptions,
  type PostgreSQLQueryResult,
  type PostgreSQLRow,
  type PostgreSQLValue
} from '../src/providers/persistence/postgresql/index.ts';

test('postgresql config is memory by default and requires explicit URL in postgresql mode', () => {
  assert.equal(createPostgreSQLPersistenceConfigFromEnv({}).mode, 'memory');
  assert.throws(
    () => createPostgreSQLPersistenceConfigFromEnv({ ASTERIA_PERSISTENCE_MODE: 'postgresql' }),
    /ASTERIA_POSTGRESQL_URL/
  );
});

test('postgresql config parses pool options and redacts invalid values without URL leakage', () => {
  const config = createPostgreSQLPersistenceConfigFromEnv({
    ASTERIA_PERSISTENCE_MODE: 'postgresql',
    ASTERIA_POSTGRESQL_URL: 'postgresql://user:secret@example.test:5432/asteria',
    ASTERIA_POSTGRESQL_POOL_MIN: '1',
    ASTERIA_POSTGRESQL_POOL_MAX: '5',
    ASTERIA_POSTGRESQL_CONNECTION_TIMEOUT_MS: '2000',
    ASTERIA_POSTGRESQL_IDLE_TIMEOUT_MS: '3000',
    ASTERIA_POSTGRESQL_STATEMENT_TIMEOUT_MS: '4000',
    ASTERIA_POSTGRESQL_SSL_MODE: 'require'
  });
  const options = createPoolOptions(config);

  assert.equal(options.connectionString, 'postgresql://user:secret@example.test:5432/asteria');
  assert.equal(options.min, 1);
  assert.equal(options.max, 5);
  assert.equal(options.connectionTimeoutMillis, 2000);
  assert.equal(options.idleTimeoutMillis, 3000);
  assert.equal(options.statement_timeout, 4000);
  assert.deepEqual(options.ssl, { rejectUnauthorized: false });
  assert.throws(
    () =>
      createPostgreSQLPersistenceConfigFromEnv({
        ASTERIA_PERSISTENCE_MODE: 'postgresql',
        ASTERIA_POSTGRESQL_URL: 'postgresql://user:secret@example.test/asteria',
        ASTERIA_POSTGRESQL_POOL_MAX: '-1'
      }),
    (error) => error instanceof Error && !error.message.includes('secret')
  );
});

test('postgresql pool connection maps queries through the pool outside transactions', async () => {
  const pool = new FakePool();
  const connection = new PostgreSQLPoolConnection(pool);

  await connection.query('SELECT $1::text AS value', ['cat']);

  assert.deepEqual(pool.queries.map((entry) => entry.sql), ['SELECT $1::text AS value']);
  assert.equal(pool.clients.length, 0);
});

test('postgresql pool connection commits transaction and routes repository queries through the same client', async () => {
  const pool = new FakePool();
  const connection = new PostgreSQLPoolConnection(pool);

  await connection.transaction(async (transactionConnection) => {
    await transactionConnection.query('INSERT INTO scheduled_jobs VALUES ($1)', ['job-1']);
    await connection.query('UPDATE publishing_queue_items SET status = $1', ['PROCESSING']);
  });

  const client = pool.clients[0];
  assert.deepEqual(client.queries.map((entry) => entry.sql), [
    'BEGIN',
    'INSERT INTO scheduled_jobs VALUES ($1)',
    'UPDATE publishing_queue_items SET status = $1',
    'COMMIT'
  ]);
  assert.equal(client.released, true);
});

test('postgresql pool connection rolls back transaction and releases client on failure', async () => {
  const pool = new FakePool();
  const connection = new PostgreSQLPoolConnection(pool);

  await assert.rejects(
    () =>
      connection.transaction(async (transactionConnection) => {
        await transactionConnection.query('INSERT INTO scheduled_jobs VALUES ($1)', ['job-1']);
        throw new Error('rollback please');
      }),
    /rollback please/
  );

  const client = pool.clients[0];
  assert.deepEqual(client.queries.map((entry) => entry.sql), [
    'BEGIN',
    'INSERT INTO scheduled_jobs VALUES ($1)',
    'ROLLBACK'
  ]);
  assert.equal(client.released, true);
});

test('postgresql pool connection supports health check and idempotent close', async () => {
  const pool = new FakePool();
  const connection = new PostgreSQLPoolConnection(pool);

  assert.equal(await connection.healthCheck(), true);
  await connection.close();
  await connection.close();

  assert.equal(pool.endCount, 1);
  await assert.rejects(
    () => connection.query('SELECT 1'),
    /already closed/
  );
});

test('postgresql pool creation accepts injected driver and keeps pg-specific types inside adapter', () => {
  const driver = {
    Pool: FakePool
  };
  const connection = createPostgreSQLPoolConnection({
    mode: 'postgresql',
    connectionUrl: 'postgresql://user:secret@example.test/asteria',
    poolMax: 2
  }, {
    driver
  });

  assert.ok(connection instanceof PostgreSQLPoolConnection);
});

test('postgresql driver errors redact URLs and passwords', () => {
  const error = redactPostgreSQLDriverError(
    new Error('could not connect to postgresql://user:secret@example.test/asteria?password=secret')
  );

  assert.ok(error instanceof PostgreSQLDriverError);
  assert.equal(error.message.includes('secret'), false);
  assert.equal(error.message.includes('example.test'), false);
});

interface QueryEntry {
  sql: string;
  values?: readonly PostgreSQLValue[];
}

class FakePool implements PostgreSQLPoolLike {
  readonly queries: QueryEntry[] = [];
  readonly clients: FakeClient[] = [];
  endCount = 0;
  readonly options: PostgreSQLPoolOptions;

  constructor(options: PostgreSQLPoolOptions = { connectionString: 'postgresql://test' }) {
    this.options = options;
  }

  async query<Row extends PostgreSQLRow = PostgreSQLRow>(
    sql: string,
    values?: readonly PostgreSQLValue[]
  ): Promise<PostgreSQLQueryResult<Row>> {
    this.queries.push({ sql, values });
    return {
      rows: [] as Row[],
      rowCount: 0
    };
  }

  async connect(): Promise<PostgreSQLPoolClientLike> {
    const client = new FakeClient();
    this.clients.push(client);
    return client;
  }

  async end(): Promise<void> {
    this.endCount += 1;
  }
}

class FakeClient implements PostgreSQLPoolClientLike {
  readonly queries: QueryEntry[] = [];
  released = false;

  async query<Row extends PostgreSQLRow = PostgreSQLRow>(
    sql: string,
    values?: readonly PostgreSQLValue[]
  ): Promise<PostgreSQLQueryResult<Row>> {
    this.queries.push({ sql, values });
    return {
      rows: [] as Row[],
      rowCount: 0
    };
  }

  release(): void {
    this.released = true;
  }
}
