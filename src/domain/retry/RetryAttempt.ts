import type { RetryReason } from './RetryReason.ts';

export type RetryAttemptStatus = 'success' | 'failed';

export interface RetryAttempt {
  attemptNumber: number;
  status: RetryAttemptStatus;
  startedAt: string;
  endedAt: string;
  delayMs: number;
  reason?: RetryReason;
}
