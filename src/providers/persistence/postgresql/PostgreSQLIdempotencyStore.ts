import type {
  IdempotencyRecord,
  IdempotencyStore,
  PersistenceFailure
} from '../../../services/persistence/index.ts';
import type { PostgreSQLConnection, PostgreSQLRow } from './PostgreSQLConnection.ts';
import { optionalString, parseJson, stringifyJson, timestampString } from './PostgreSQLSerialization.ts';

export class PostgreSQLIdempotencyStore implements IdempotencyStore {
  private readonly connection: PostgreSQLConnection;

  constructor(connection: PostgreSQLConnection) {
    this.connection = connection;
  }

  async claim(key: string, scope: string, metadata?: Record<string, unknown>): Promise<IdempotencyRecord> {
    const existing = await this.get(key, scope);

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    await this.connection.query(`
      INSERT INTO idempotency_records (
        scope, key, status, result_reference, failure_json, metadata_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
      ON CONFLICT (scope, key) DO NOTHING
    `, [scope, key, 'CLAIMED', null, null, metadata ? stringifyJson(metadata) : null, now, now]);

    return this.requireRecord(key, scope);
  }

  async complete(key: string, scope: string, resultReference: string): Promise<IdempotencyRecord> {
    await this.requireRecord(key, scope);
    const now = new Date().toISOString();
    await this.connection.query(`
      UPDATE idempotency_records
      SET status = 'COMPLETED', result_reference = $1, failure_json = NULL, updated_at = $2
      WHERE scope = $3 AND key = $4
    `, [resultReference, now, scope, key]);

    return this.requireRecord(key, scope);
  }

  async fail(key: string, scope: string, failure: PersistenceFailure): Promise<IdempotencyRecord> {
    await this.requireRecord(key, scope);
    const now = new Date().toISOString();
    await this.connection.query(`
      UPDATE idempotency_records
      SET status = 'FAILED', failure_json = $1::jsonb, updated_at = $2
      WHERE scope = $3 AND key = $4
    `, [stringifyJson({
      reason: failure.reason,
      code: failure.code,
      retryable: failure.retryable
    }), now, scope, key]);

    return this.requireRecord(key, scope);
  }

  async get(key: string, scope: string): Promise<IdempotencyRecord | undefined> {
    const result = await this.connection.query('SELECT * FROM idempotency_records WHERE scope = $1 AND key = $2', [scope, key]);
    return result.rows[0] ? mapIdempotencyRow(result.rows[0]) : undefined;
  }

  private async requireRecord(key: string, scope: string): Promise<IdempotencyRecord> {
    const record = await this.get(key, scope);

    if (!record) {
      throw new Error(`Idempotency record not found for ${scope}:${key}.`);
    }

    return record;
  }
}

function mapIdempotencyRow(row: PostgreSQLRow): IdempotencyRecord {
  return {
    key: String(row.key),
    scope: String(row.scope),
    status: row.status as IdempotencyRecord['status'],
    createdAt: timestampString(row.created_at),
    updatedAt: timestampString(row.updated_at),
    resultReference: optionalString(row.result_reference),
    failure: row.failure_json ? parseJson<IdempotencyRecord['failure']>(row.failure_json) : undefined,
    metadata: row.metadata_json ? parseJson<Record<string, unknown>>(row.metadata_json) : undefined
  };
}
