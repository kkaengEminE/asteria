export type AsteriaPersistenceMode = 'memory' | 'sqlite';

export interface SQLitePersistenceEnvironment {
  ASTERIA_PERSISTENCE_MODE?: string;
  ASTERIA_SQLITE_DATABASE_PATH?: string;
}

export interface SQLitePersistenceConfig {
  mode: AsteriaPersistenceMode;
  databasePath?: string;
}

export class SQLitePersistenceConfigError extends Error {
  readonly code = 'sqlite_persistence_config_error';
}

export function createSQLitePersistenceConfigFromEnv(env: SQLitePersistenceEnvironment = process.env): SQLitePersistenceConfig {
  const mode = parsePersistenceMode(env.ASTERIA_PERSISTENCE_MODE);

  if (mode === 'sqlite' && !env.ASTERIA_SQLITE_DATABASE_PATH) {
    throw new SQLitePersistenceConfigError(
      'SQLite persistence requires ASTERIA_SQLITE_DATABASE_PATH when ASTERIA_PERSISTENCE_MODE=sqlite.'
    );
  }

  return {
    mode,
    databasePath: env.ASTERIA_SQLITE_DATABASE_PATH
  };
}

function parsePersistenceMode(value: string | undefined): AsteriaPersistenceMode {
  if (value === undefined || value.trim() === '' || value === 'memory') {
    return 'memory';
  }

  if (value === 'sqlite') {
    return 'sqlite';
  }

  throw new SQLitePersistenceConfigError(
    `Unsupported ASTERIA_PERSISTENCE_MODE "${value}". Expected "memory" or "sqlite".`
  );
}
