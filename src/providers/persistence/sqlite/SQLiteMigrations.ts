import type { SQLiteDatabase } from './SQLiteConnection.ts';

export const SQLITE_SCHEMA_VERSION = 1;

export class SQLiteMigrationError extends Error {
  readonly code = 'sqlite_migration_error';
}

export function migrateSQLiteDatabase(database: SQLiteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const rows = database.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all();
  const versions = rows.map((row) => Number(row.version));
  const unsupported = versions.find((version) => version > SQLITE_SCHEMA_VERSION);

  if (unsupported !== undefined) {
    throw new SQLiteMigrationError(
      `Unsupported SQLite schema version ${unsupported}. This adapter supports version ${SQLITE_SCHEMA_VERSION}.`
    );
  }

  if (!versions.includes(1)) {
    applyVersion1(database);
    database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());
  }
}

function applyVersion1(database: SQLiteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS publishing_queue_items (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      destination_type TEXT NOT NULL,
      magazine_slug TEXT,
      idempotency_key TEXT,
      data_json TEXT NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_publishing_queue_status ON publishing_queue_items(status);
    CREATE INDEX IF NOT EXISTS idx_publishing_queue_destination_type ON publishing_queue_items(destination_type);
    CREATE INDEX IF NOT EXISTS idx_publishing_queue_magazine_slug ON publishing_queue_items(magazine_slug);
    CREATE INDEX IF NOT EXISTS idx_publishing_queue_idempotency_key ON publishing_queue_items(idempotency_key);

    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id TEXT PRIMARY KEY,
      queue_item_id TEXT NOT NULL,
      status TEXT NOT NULL,
      scheduled_for TEXT NOT NULL,
      data_json TEXT NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_queue_item_id ON scheduled_jobs(queue_item_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_for ON scheduled_jobs(scheduled_for);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_jobs_active_queue_item ON scheduled_jobs(queue_item_id)
      WHERE status = 'SCHEDULED';

    CREATE TABLE IF NOT EXISTS job_executions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      queue_item_id TEXT,
      status TEXT NOT NULL,
      data_json TEXT NOT NULL,
      revision INTEGER NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_job_executions_job_id ON job_executions(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_executions_queue_item_id ON job_executions(queue_item_id);
    CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status);

    CREATE TABLE IF NOT EXISTS idempotency_records (
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      status TEXT NOT NULL,
      result_reference TEXT,
      failure_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (scope, key)
    );

    CREATE INDEX IF NOT EXISTS idx_idempotency_records_status ON idempotency_records(status);

    CREATE TABLE IF NOT EXISTS execution_locks (
      key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      token TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      metadata_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_execution_locks_expires_at ON execution_locks(expires_at);
  `);
}
