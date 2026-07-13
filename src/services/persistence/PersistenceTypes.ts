export type PersistenceRevision = number;

export interface Revisioned<T> {
  value: T;
  revision: PersistenceRevision;
}

export interface RevisionCheck {
  expectedRevision?: PersistenceRevision;
}

export interface PageCursor {
  value: string;
}

export interface PageRequest {
  limit?: number;
  cursor?: PageCursor;
}

export interface PageResult<T> {
  items: T[];
  nextCursor?: PageCursor;
}

export interface TransactionContext {
  id: string;
  metadata?: Record<string, unknown>;
}

export interface LockToken {
  key: string;
  owner: string;
  token: string;
  acquiredAt: string;
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

export type IdempotencyStatus = 'CLAIMED' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord {
  key: string;
  scope: string;
  status: IdempotencyStatus;
  createdAt: string;
  updatedAt: string;
  resultReference?: string;
  failure?: {
    reason: string;
    code?: string;
    retryable?: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface PersistenceFailure {
  reason: string;
  code?: string;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
}

