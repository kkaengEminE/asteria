export type PostgreSQLPersistenceMode = 'memory' | 'sqlite' | 'postgresql';

export interface PostgreSQLPersistenceEnvironment {
  ASTERIA_PERSISTENCE_MODE?: string;
  ASTERIA_POSTGRES_CONNECTION_URL?: string;
}

export interface PostgreSQLPersistenceConfig {
  mode: PostgreSQLPersistenceMode;
  connectionUrl?: string;
}

export class PostgreSQLPersistenceConfigError extends Error {
  readonly code = 'postgresql_persistence_config_error';
}

export function createPostgreSQLPersistenceConfigFromEnv(
  env: PostgreSQLPersistenceEnvironment = process.env
): PostgreSQLPersistenceConfig {
  const mode = parsePersistenceMode(env.ASTERIA_PERSISTENCE_MODE);

  if (mode === 'postgresql' && !env.ASTERIA_POSTGRES_CONNECTION_URL) {
    throw new PostgreSQLPersistenceConfigError(
      'PostgreSQL persistence requires ASTERIA_POSTGRES_CONNECTION_URL when ASTERIA_PERSISTENCE_MODE=postgresql.'
    );
  }

  return {
    mode,
    connectionUrl: env.ASTERIA_POSTGRES_CONNECTION_URL
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
