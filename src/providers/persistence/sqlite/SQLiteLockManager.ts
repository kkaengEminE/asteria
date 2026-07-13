import type { LockManager, LockToken } from '../../../services/persistence/index.ts';
import type { SQLiteDatabase, SQLiteRow } from './SQLiteConnection.ts';
import { parseJson, stringifyJson } from './SQLiteSerialization.ts';

export class SQLiteLockManager implements LockManager {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  async acquire(lockKey: string, owner: string, ttlMs: number, now = new Date().toISOString()): Promise<LockToken | undefined> {
    const existing = this.getActive(lockKey, now);

    if (existing) {
      return undefined;
    }

    const token = createLockToken(lockKey, owner, ttlMs, now);
    this.database.prepare(`
      INSERT INTO execution_locks (key, owner, token, acquired_at, expires_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        owner = excluded.owner,
        token = excluded.token,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at,
        metadata_json = excluded.metadata_json
      WHERE execution_locks.expires_at <= ?
    `).run(token.key, token.owner, token.token, token.acquiredAt, token.expiresAt, null, now);

    const acquired = this.getActive(lockKey, now);
    return acquired?.token === token.token ? acquired : undefined;
  }

  async renew(token: LockToken, ttlMs: number, now = new Date().toISOString()): Promise<LockToken | undefined> {
    const existing = this.getActive(token.key, now);

    if (!existing || existing.token !== token.token) {
      return undefined;
    }

    const renewed = {
      ...existing,
      expiresAt: addMs(now, ttlMs)
    };

    this.database.prepare('UPDATE execution_locks SET expires_at = ? WHERE key = ? AND token = ?')
      .run(renewed.expiresAt, renewed.key, renewed.token);

    return renewed;
  }

  async release(token: LockToken): Promise<boolean> {
    const result = this.database.prepare('DELETE FROM execution_locks WHERE key = ? AND token = ?').run(token.key, token.token);
    return result.changes === 1;
  }

  async get(lockKey: string): Promise<LockToken | undefined> {
    return this.getActive(lockKey, new Date().toISOString());
  }

  private getActive(lockKey: string, now: string): LockToken | undefined {
    const row = this.database.prepare('SELECT * FROM execution_locks WHERE key = ?').get(lockKey);

    if (!row) {
      return undefined;
    }

    const token = mapLockRow(row);

    if (isExpired(token, now)) {
      this.database.prepare('DELETE FROM execution_locks WHERE key = ? AND token = ?').run(token.key, token.token);
      return undefined;
    }

    return token;
  }
}

function mapLockRow(row: SQLiteRow): LockToken {
  return {
    key: String(row.key),
    owner: String(row.owner),
    token: String(row.token),
    acquiredAt: String(row.acquired_at),
    expiresAt: String(row.expires_at),
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

function isExpired(token: LockToken, now = new Date().toISOString()): boolean {
  return Date.parse(token.expiresAt) <= Date.parse(now);
}

function addMs(isoDate: string, ms: number): string {
  return new Date(Date.parse(isoDate) + ms).toISOString();
}
