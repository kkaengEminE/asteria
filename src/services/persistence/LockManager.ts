import type { LockToken } from './PersistenceTypes.ts';

export interface LockManager {
  acquire(lockKey: string, owner: string, ttlMs: number, now?: string): Promise<LockToken | undefined>;
  renew(token: LockToken, ttlMs: number, now?: string): Promise<LockToken | undefined>;
  release(token: LockToken): Promise<boolean>;
  get(lockKey: string): Promise<LockToken | undefined>;
}

