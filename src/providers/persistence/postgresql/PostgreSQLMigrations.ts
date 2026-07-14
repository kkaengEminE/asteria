import type { PostgreSQLConnection } from './PostgreSQLConnection.ts';

export const POSTGRESQL_SCHEMA_VERSION = 1;

export class PostgreSQLMigrationError extends Error {
  readonly code = 'postgresql_migration_error';
}

export async function migratePostgreSQLDatabase(connection: PostgreSQLConnection): Promise<void> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL
    );
  `);

  const applied = await connection.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version ASC');
  const versions = applied.rows.map((row) => Number(row.version));
  const unsupported = versions.find((version) => version > POSTGRESQL_SCHEMA_VERSION);

  if (unsupported !== undefined) {
    throw new PostgreSQLMigrationError(
      `Unsupported PostgreSQL schema version ${unsupported}. This adapter supports version ${POSTGRESQL_SCHEMA_VERSION}.`
    );
  }

  if (!versions.includes(1)) {
    await applyVersion1(connection);
    await connection.query('INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)', [
      1,
      new Date().toISOString()
    ]);
  }
}

async function applyVersion1(connection: PostgreSQLConnection): Promise<void> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS publishing_queue_items (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      destination_type TEXT NOT NULL,
      magazine_slug TEXT,
      idempotency_key TEXT,
      data_json JSONB NOT NULL,
      revision INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pg_publishing_queue_status ON publishing_queue_items(status);
    CREATE INDEX IF NOT EXISTS idx_pg_publishing_queue_destination_type ON publishing_queue_items(destination_type);
    CREATE INDEX IF NOT EXISTS idx_pg_publishing_queue_magazine_slug ON publishing_queue_items(magazine_slug);
    CREATE INDEX IF NOT EXISTS idx_pg_publishing_queue_idempotency_key ON publishing_queue_items(idempotency_key);

    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id TEXT PRIMARY KEY,
      queue_item_id TEXT NOT NULL,
      status TEXT NOT NULL,
      scheduled_for TIMESTAMPTZ NOT NULL,
      data_json JSONB NOT NULL,
      revision INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pg_scheduled_jobs_queue_item_id ON scheduled_jobs(queue_item_id);
    CREATE INDEX IF NOT EXISTS idx_pg_scheduled_jobs_status ON scheduled_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_pg_scheduled_jobs_scheduled_for ON scheduled_jobs(scheduled_for);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_scheduled_jobs_active_queue_item ON scheduled_jobs(queue_item_id)
      WHERE status = 'SCHEDULED';

    CREATE TABLE IF NOT EXISTS job_executions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      queue_item_id TEXT,
      status TEXT NOT NULL,
      data_json JSONB NOT NULL,
      revision INTEGER NOT NULL,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_pg_job_executions_job_id ON job_executions(job_id);
    CREATE INDEX IF NOT EXISTS idx_pg_job_executions_queue_item_id ON job_executions(queue_item_id);
    CREATE INDEX IF NOT EXISTS idx_pg_job_executions_status ON job_executions(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_job_executions_active_job ON job_executions(job_id)
      WHERE status = 'RUNNING';

    CREATE TABLE IF NOT EXISTS idempotency_records (
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      status TEXT NOT NULL,
      result_reference TEXT,
      failure_json JSONB,
      metadata_json JSONB,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (scope, key)
    );

    CREATE INDEX IF NOT EXISTS idx_pg_idempotency_records_status ON idempotency_records(status);

    CREATE TABLE IF NOT EXISTS execution_locks (
      key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      token TEXT NOT NULL,
      acquired_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      metadata_json JSONB,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pg_execution_locks_expires_at ON execution_locks(expires_at);
  `);
}
