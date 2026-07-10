export interface RetryPolicy {
  maxAttempts: number;
  delayMs: number;
  retryableReasons?: string[];
  nonRetryableReasons?: string[];
}

export function createRetryPolicy(policy: Partial<RetryPolicy> = {}): RetryPolicy {
  const maxAttempts = policy.maxAttempts ?? 1;
  const delayMs = policy.delayMs ?? 0;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('Retry policy maxAttempts must be a positive integer.');
  }

  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error('Retry policy delayMs must be zero or a positive number.');
  }

  return {
    maxAttempts,
    delayMs,
    retryableReasons: policy.retryableReasons ?? [],
    nonRetryableReasons: policy.nonRetryableReasons ?? []
  };
}
