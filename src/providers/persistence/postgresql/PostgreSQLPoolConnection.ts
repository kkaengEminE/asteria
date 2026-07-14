import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import type {
  PostgreSQLPersistenceConfig,
  PostgreSQLSSLMode
} from './PostgreSQLConfig.ts';
import type {
  PostgreSQLConnection,
  PostgreSQLQueryResult,
  PostgreSQLRow,
  PostgreSQLValue
} from './PostgreSQLConnection.ts';

export interface PostgreSQLPoolClientLike {
  query<Row extends PostgreSQLRow = PostgreSQLRow>(
    sql: string,
    values?: readonly PostgreSQLValue[]
  ): Promise<PostgreSQLQueryResult<Row>>;
  release(): void;
}

export interface PostgreSQLPoolLike {
  query<Row extends PostgreSQLRow = PostgreSQLRow>(
    sql: string,
    values?: readonly PostgreSQLValue[]
  ): Promise<PostgreSQLQueryResult<Row>>;
  connect(): Promise<PostgreSQLPoolClientLike>;
  end(): Promise<void>;
}

export interface PostgreSQLDriverModule {
  Pool: new (options: PostgreSQLPoolOptions) => PostgreSQLPoolLike;
}

export interface PostgreSQLPoolOptions {
  connectionString: string;
  min?: number;
  max?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  statement_timeout?: number;
  ssl?: boolean | {
    rejectUnauthorized: boolean;
  };
}

export interface CreatePostgreSQLPoolConnectionOptions {
  driver?: PostgreSQLDriverModule;
}

export class PostgreSQLDriverError extends Error {
  readonly code = 'postgresql_driver_error';
}

export class PostgreSQLPoolConnection implements PostgreSQLConnection {
  private readonly pool: PostgreSQLPoolLike;
  private readonly transactionClientStore = new AsyncLocalStorage<PostgreSQLPoolClientLike>();
  private closed = false;

  constructor(pool: PostgreSQLPoolLike) {
    this.pool = pool;
  }

  async query<Row extends PostgreSQLRow = PostgreSQLRow>(
    sql: string,
    values?: readonly PostgreSQLValue[]
  ): Promise<PostgreSQLQueryResult<Row>> {
    this.assertOpen();
    const client = this.transactionClientStore.getStore();

    try {
      return await (client ?? this.pool).query<Row>(sql, values);
    } catch (error) {
      throw redactPostgreSQLDriverError(error);
    }
  }

  async transaction<T>(callback: (connection: PostgreSQLConnection) => Promise<T>): Promise<T> {
    this.assertOpen();
    const activeClient = this.transactionClientStore.getStore();

    if (activeClient) {
      return callback(this);
    }

    const client = await this.pool.connect();

    try {
      return await this.transactionClientStore.run(client, async () => {
        await client.query('BEGIN');

        try {
          const result = await callback(this);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      });
    } catch (error) {
      throw redactPostgreSQLDriverError(error);
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    await this.query('SELECT 1 AS ok');
    return true;
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    try {
      await this.pool.end();
    } catch (error) {
      throw redactPostgreSQLDriverError(error);
    }
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new PostgreSQLDriverError('PostgreSQL connection pool is already closed.');
    }
  }
}

export function createPostgreSQLPoolConnection(
  config: PostgreSQLPersistenceConfig,
  options: CreatePostgreSQLPoolConnectionOptions = {}
): PostgreSQLPoolConnection {
  if (config.mode !== 'postgresql' || !config.connectionUrl) {
    throw new PostgreSQLDriverError(
      'PostgreSQL pool creation requires ASTERIA_PERSISTENCE_MODE=postgresql and ASTERIA_POSTGRESQL_URL.'
    );
  }

  const driver = options.driver ?? loadPostgreSQLDriver();
  return new PostgreSQLPoolConnection(new driver.Pool(createPoolOptions(config)));
}

export function createPoolOptions(config: PostgreSQLPersistenceConfig): PostgreSQLPoolOptions {
  if (!config.connectionUrl) {
    throw new PostgreSQLDriverError('PostgreSQL connection URL is required.');
  }

  return {
    connectionString: config.connectionUrl,
    min: config.poolMin,
    max: config.poolMax,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
    statement_timeout: config.statementTimeoutMs,
    ssl: createSSLConfig(config.sslMode)
  };
}

export function redactPostgreSQLDriverError(error: unknown): PostgreSQLDriverError {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[REDACTED_POSTGRESQL_URL]')
    .replace(/password=([^&\s]+)/gi, 'password=[REDACTED]');
  return new PostgreSQLDriverError(redacted);
}

function createSSLConfig(mode: PostgreSQLSSLMode | undefined): PostgreSQLPoolOptions['ssl'] {
  if (!mode || mode === 'disable') {
    return undefined;
  }

  if (mode === 'require') {
    return {
      rejectUnauthorized: false
    };
  }

  return {
    rejectUnauthorized: true
  };
}

function loadPostgreSQLDriver(): PostgreSQLDriverModule {
  const require = createRequire(import.meta.url);
  return require('pg') as PostgreSQLDriverModule;
}
