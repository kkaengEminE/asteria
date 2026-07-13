import type { IdempotencyRecord, PersistenceFailure } from './PersistenceTypes.ts';

export interface IdempotencyStore {
  claim(key: string, scope: string, metadata?: Record<string, unknown>): Promise<IdempotencyRecord>;
  complete(key: string, scope: string, resultReference: string): Promise<IdempotencyRecord>;
  fail(key: string, scope: string, failure: PersistenceFailure): Promise<IdempotencyRecord>;
  get(key: string, scope: string): Promise<IdempotencyRecord | undefined>;
}

