export type PostgreSQLPersistenceMode = 'memory' | 'sqlite' | 'postgresql';

export interface PostgreSQLPersistenceEnvironment {
  ASTERIA_PERSISTENCE_MODE?: string;
  ASTERIA_POSTGRESQL_URL?: string;
  ASTERIA_POSTGRES_CONNECTION_URL?: string;
  ASTERIA_POSTGRESQL_POOL_MIN?: string;
  ASTERIA_POSTGRESQL_POOL_MAX?: string;
  ASTERIA_POSTGRESQL_CONNECTION_TIMEOUT_MS?: string;
  ASTERIA_POSTGRESQL_IDLE_TIMEOUT_MS?: string;
  ASTERIA_POSTGRESQL_STATEMENT_TIMEOUT_MS?: string;
  ASTERIA_POSTGRESQL_SSL_MODE?: string;
}

export interface PostgreSQLPersistenceConfig {
  mode: PostgreSQLPersistenceMode;
  connectionUrl?: string;
  poolMin?: number;
  poolMax?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  statementTimeoutMs?: number;
  sslMode?: PostgreSQLSSLMode;
}

export type PostgreSQLSSLMode = 'disable' | 'require' | 'verify-full';

export class PostgreSQLPersistenceConfigError extends Error {
  readonly code = 'postgresql_persistence_config_error';
}

export function createPostgreSQLPersistenceConfigFromEnv(
  env: PostgreSQLPersistenceEnvironment = process.env
): PostgreSQLPersistenceConfig {
  const mode = parsePersistenceMode(env.ASTERIA_PERSISTENCE_MODE);
  const connectionUrl = firstNonEmpty(env.ASTERIA_POSTGRESQL_URL, env.ASTERIA_POSTGRES_CONNECTION_URL);

  if (mode === 'postgresql' && !connectionUrl) {
    throw new PostgreSQLPersistenceConfigError(
      'PostgreSQL persistence requires ASTERIA_POSTGRESQL_URL when ASTERIA_PERSISTENCE_MODE=postgresql.'
    );
  }

  return {
    mode,
    connectionUrl,
    poolMin: parseOptionalInteger('ASTERIA_POSTGRESQL_POOL_MIN', env.ASTERIA_POSTGRESQL_POOL_MIN),
    poolMax: parseOptionalInteger('ASTERIA_POSTGRESQL_POOL_MAX', env.ASTERIA_POSTGRESQL_POOL_MAX),
    connectionTimeoutMs: parseOptionalInteger(
      'ASTERIA_POSTGRESQL_CONNECTION_TIMEOUT_MS',
      env.ASTERIA_POSTGRESQL_CONNECTION_TIMEOUT_MS
    ),
    idleTimeoutMs: parseOptionalInteger('ASTERIA_POSTGRESQL_IDLE_TIMEOUT_MS', env.ASTERIA_POSTGRESQL_IDLE_TIMEOUT_MS),
    statementTimeoutMs: parseOptionalInteger(
      'ASTERIA_POSTGRESQL_STATEMENT_TIMEOUT_MS',
      env.ASTERIA_POSTGRESQL_STATEMENT_TIMEOUT_MS
    ),
    sslMode: parseSSLMode(env.ASTERIA_POSTGRESQL_SSL_MODE)
  };
}

function parsePersistenceMode(value: string | undefined): PostgreSQLPersistenceMode {
  if (value === undefined || value.trim() === '' || value === 'memory') {
    return 'memory';
  }

  if (value === 'sqlite') {
    return 'sqlite';
  }

  if (value === 'postgresql' || value === 'postgres') {
    return 'postgresql';
  }

  throw new PostgreSQLPersistenceConfigError(
    `Unsupported ASTERIA_PERSISTENCE_MODE "${value}". Expected "memory", "sqlite", or "postgresql".`
  );
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim() !== '');
}

function parseOptionalInteger(name: string, value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new PostgreSQLPersistenceConfigError(`${name} must be a non-negative integer.`);
  }

  return parsed;
}

function parseSSLMode(value: string | undefined): PostgreSQLSSLMode | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  if (value === 'disable' || value === 'require' || value === 'verify-full') {
    return value;
  }

  throw new PostgreSQLPersistenceConfigError(
    'ASTERIA_POSTGRESQL_SSL_MODE must be one of disable, require, or verify-full.'
  );
}
