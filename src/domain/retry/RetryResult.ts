import type { RetryAttempt } from './RetryAttempt.ts';
import type { RetryPolicy } from './RetryPolicy.ts';
import type { RetryReason } from './RetryReason.ts';

export type RetryResultStatus = 'success' | 'exhausted' | 'non_retryable';

export interface RetryResult<T = unknown> {
  status: RetryResultStatus;
  value?: T;
  error?: unknown;
  attempts: RetryAttempt[];
  attemptCount: number;
  retryCount: number;
  policy: RetryPolicy;
  finalReason?: RetryReason;
}
