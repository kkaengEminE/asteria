import type { IdempotencyStore } from '../IdempotencyStore.ts';
import type { IdempotencyRecord, PersistenceFailure } from '../PersistenceTypes.ts';

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  async claim(key: string, scope: string, metadata?: Record<string, unknown>): Promise<IdempotencyRecord> {
    const recordKey = createRecordKey(key, scope);
    const existing = this.records.get(recordKey);

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const record: IdempotencyRecord = {
      key,
      scope,
      status: 'CLAIMED',
      createdAt: now,
      updatedAt: now,
      metadata
    };

    this.records.set(recordKey, record);

    return record;
  }

  async complete(key: string, scope: string, resultReference: string): Promise<IdempotencyRecord> {
    const record = await this.requireRecord(key, scope);
    const updated = {
      ...record,
      status: 'COMPLETED' as const,
      resultReference,
      updatedAt: new Date().toISOString()
    };

    this.records.set(createRecordKey(key, scope), updated);

    return updated;
  }

  async fail(key: string, scope: string, failure: PersistenceFailure): Promise<IdempotencyRecord> {
    const record = await this.requireRecord(key, scope);
    const updated = {
      ...record,
      status: 'FAILED' as const,
      failure: {
        reason: failure.reason,
        code: failure.code,
        retryable: failure.retryable
      },
      updatedAt: new Date().toISOString()
    };

    this.records.set(createRecordKey(key, scope), updated);

    return updated;
  }

  async get(key: string, scope: string): Promise<IdempotencyRecord | undefined> {
    return this.records.get(createRecordKey(key, scope));
  }

  private async requireRecord(key: string, scope: string): Promise<IdempotencyRecord> {
    const record = await this.get(key, scope);

    if (!record) {
      throw new Error(`Idempotency record not found for ${scope}:${key}.`);
    }

    return record;
  }
}

function createRecordKey(key: string, scope: string): string {
  return `${scope}:${key}`;
}

