import type {
  IdempotencyRecord,
  IdempotencyStore,
  PersistenceFailure
} from '../../../services/persistence/index.ts';
import type { SQLiteDatabase, SQLiteRow } from './SQLiteConnection.ts';
import { parseJson, stringifyJson } from './SQLiteSerialization.ts';

export class SQLiteIdempotencyStore implements IdempotencyStore {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  async claim(key: string, scope: string, metadata?: Record<string, unknown>): Promise<IdempotencyRecord> {
    const existing = await this.get(key, scope);

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO idempotency_records (
        scope, key, status, result_reference, failure_json, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(scope, key, 'CLAIMED', null, null, metadata ? stringifyJson(metadata) : null, now, now);

    return {
      key,
      scope,
      status: 'CLAIMED',
      createdAt: now,
      updatedAt: now,
      metadata
    };
  }

  async complete(key: string, scope: string, resultReference: string): Promise<IdempotencyRecord> {
    await this.requireRecord(key, scope);
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE idempotency_records
      SET status = 'COMPLETED', result_reference = ?, failure_json = NULL, updated_at = ?
      WHERE scope = ? AND key = ?
    `).run(resultReference, now, scope, key);

    return this.requireRecord(key, scope);
  }

  async fail(key: string, scope: string, failure: PersistenceFailure): Promise<IdempotencyRecord> {
    await this.requireRecord(key, scope);
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE idempotency_records
      SET status = 'FAILED', failure_json = ?, updated_at = ?
      WHERE scope = ? AND key = ?
    `).run(stringifyJson({
      reason: failure.reason,
      code: failure.code,
      retryable: failure.retryable
    }), now, scope, key);

    return this.requireRecord(key, scope);
  }

  async get(key: string, scope: string): Promise<IdempotencyRecord | undefined> {
    const row = this.database.prepare('SELECT * FROM idempotency_records WHERE scope = ? AND key = ?').get(scope, key);
    return row ? mapIdempotencyRow(row) : undefined;
  }

  private async requireRecord(key: string, scope: string): Promise<IdempotencyRecord> {
    const record = await this.get(key, scope);

    if (!record) {
      throw new Error(`Idempotency record not found for ${scope}:${key}.`);
    }

    return record;
  }
}

function mapIdempotencyRow(row: SQLiteRow): IdempotencyRecord {
  return {
    key: String(row.key),
    scope: String(row.scope),
    status: row.status as IdempotencyRecord['status'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    resultReference: optionalString(row.result_reference),
    failure: row.failure_json ? parseJson<IdempotencyRecord['failure']>(row.failure_json) : undefined,
    metadata: row.metadata_json ? parseJson<Record<string, unknown>>(row.metadata_json) : undefined
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
