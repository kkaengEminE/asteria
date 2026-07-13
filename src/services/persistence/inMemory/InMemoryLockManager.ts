import type { LockManager } from '../LockManager.ts';
import type { LockToken } from '../PersistenceTypes.ts';

export class InMemoryLockManager implements LockManager {
  private readonly locks = new Map<string, LockToken>();

  async acquire(lockKey: string, owner: string, ttlMs: number, now = new Date().toISOString()): Promise<LockToken | undefined> {
    const existing = this.locks.get(lockKey);

    if (existing && !isExpired(existing, now)) {
      return undefined;
    }

    const token = createLockToken(lockKey, owner, ttlMs, now);
    this.locks.set(lockKey, token);

    return token;
  }

  async renew(token: LockToken, ttlMs: number, now = new Date().toISOString()): Promise<LockToken | undefined> {
    const existing = this.locks.get(token.key);

    if (!existing || existing.token !== token.token || isExpired(existing, now)) {
      return undefined;
    }

    const renewed = {
      ...existing,
      expiresAt: addMs(now, ttlMs)
    };

    this.locks.set(token.key, renewed);

    return renewed;
  }

  async release(token: LockToken): Promise<boolean> {
    const existing = this.locks.get(token.key);

    if (!existing || existing.token !== token.token) {
      return false;
    }

    this.locks.delete(token.key);

    return true;
  }

  async get(lockKey: string): Promise<LockToken | undefined> {
    const token = this.locks.get(lockKey);

    if (!token || isExpired(token)) {
      if (token) {
        this.locks.delete(lockKey);
      }

      return undefined;
    }

    return token;
  }
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

