import type { LockManager, LockToken } from '../../../services/persistence/index.ts';
import type { PostgreSQLConnection, PostgreSQLRow } from './PostgreSQLConnection.ts';
import { parseJson, timestampString } from './PostgreSQLSerialization.ts';

export class PostgreSQLLockManager implements LockManager {
  private readonly connection: PostgreSQLConnection;

  constructor(connection: PostgreSQLConnection) {
    this.connection = connection;
  }

  async acquire(lockKey: string, owner: string, ttlMs: number, now = new Date().toISOString()): Promise<LockToken | undefined> {
    const existing = await this.getActive(lockKey, now);

    if (existing) {
      return undefined;
    }

    const token = createLockToken(lockKey, owner, ttlMs, now);
    const result = await this.connection.query(`
      INSERT INTO execution_locks (key, owner, token, acquired_at, expires_at, metadata_json, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      ON CONFLICT (key) DO UPDATE SET
        owner = EXCLUDED.owner,
        token = EXCLUDED.token,
        acquired_at = EXCLUDED.acquired_at,
        expires_at = EXCLUDED.expires_at,
        metadata_json = EXCLUDED.metadata_json,
        updated_at = EXCLUDED.updated_at
      WHERE execution_locks.expires_at <= $8
      RETURNING *
    `, [token.key, token.owner, token.token, token.acquiredAt, token.expiresAt, null, now, now]);

    const acquired = result.rows[0] ? mapLockRow(result.rows[0]) : await this.getActive(lockKey, now);
    return acquired?.token === token.token ? acquired : undefined;
  }

  async renew(token: LockToken, ttlMs: number, now = new Date().toISOString()): Promise<LockToken | undefined> {
    const existing = await this.getActive(token.key, now);

    if (!existing || existing.token !== token.token) {
      return undefined;
    }

    const renewed = {
      ...existing,
      expiresAt: addMs(now, ttlMs)
    };

    const result = await this.connection.query(`
      UPDATE execution_locks
      SET expires_at = $1, updated_at = $2
      WHERE key = $3 AND token = $4
      RETURNING *
    `, [renewed.expiresAt, now, renewed.key, renewed.token]);

    return result.rows[0] ? mapLockRow(result.rows[0]) : undefined;
  }

  async release(token: LockToken): Promise<boolean> {
    const result = await this.connection.query('DELETE FROM execution_locks WHERE key = $1 AND token = $2', [
      token.key,
      token.token
    ]);
    return result.rowCount === 1;
  }

  async get(lockKey: string): Promise<LockToken | undefined> {
    return this.getActive(lockKey, new Date().toISOString());
  }

  private async getActive(lockKey: string, now: string): Promise<LockToken | undefined> {
    const result = await this.connection.query('SELECT * FROM execution_locks WHERE key = $1', [lockKey]);

    if (!result.rows[0]) {
      return undefined;
    }

    const token = mapLockRow(result.rows[0]);

    if (isExpired(token, now)) {
      await this.connection.query('DELETE FROM execution_locks WHERE key = $1 AND token = $2', [token.key, token.token]);
      return undefined;
    }

    return token;
  }
}

function mapLockRow(row: PostgreSQLRow): LockToken {
  return {
    key: String(row.key),
    owner: String(row.owner),
    token: String(row.token),
    acquiredAt: timestampString(row.acquired_at),
    expiresAt: timestampString(row.expires_at),
    metadata: row.metadata_json ? parseJson<Record<string, unknown>>(row.metadata_json) : undefined
  };
}

function createLockToken(lockKey: string, owner: string, ttlMs: number, now: string): LockToken {
  return {
    key: lockKey,
    owner,
    token: `${lockKey}:${owner}:${now}`,
    acquiredAt: now,
    expiresAt: addMs(now, ttlMs)
  };
}

function isExpired(token: LockToken, now: string): boolean {
  return Date.parse(token.expiresAt) <= Date.parse(now);
}

function addMs(isoDate: string, ms: number): string {
  return new Date(Date.parse(isoDate) + ms).toISOString();
}
