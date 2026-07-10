import {
  createRetryPolicy,
  type RetryAttempt,
  type RetryPolicy,
  type RetryReason,
  type RetryResult
} from '../../domain/retry/index.ts';

export interface RetryServiceExecuteOptions {
  policy?: Partial<RetryPolicy>;
  classifyError?: (error: unknown, attemptNumber: number) => RetryReason;
  now?: () => string;
}

export class RetryService {
  async execute<T>(
    operation: (attemptNumber: number) => Promise<T> | T,
    options: RetryServiceExecuteOptions = {}
  ): Promise<RetryResult<T>> {
    const policy = createRetryPolicy(options.policy);
    const now = options.now ?? (() => new Date().toISOString());
    const classifyError = options.classifyError ?? ((error: unknown) => classifyRetryReason(error, policy));
    const attempts: RetryAttempt[] = [];

    for (let attemptNumber = 1; attemptNumber <= policy.maxAttempts; attemptNumber += 1) {
      const startedAt = now();

      try {
        const value = await operation(attemptNumber);
        attempts.push({
          attemptNumber,
          status: 'success',
          startedAt,
          endedAt: now(),
          delayMs: 0
        });

        return {
          status: 'success',
          value,
          attempts,
          attemptCount: attempts.length,
          retryCount: attempts.length - 1,
          policy
        };
      } catch (error) {
        const reason = classifyError(error, attemptNumber);
        const hasAttemptsRemaining = attemptNumber < policy.maxAttempts;
        const delayMs = reason.retryable && hasAttemptsRemaining ? policy.delayMs : 0;

        attempts.push({
          attemptNumber,
          status: 'failed',
          startedAt,
          endedAt: now(),
          delayMs,
          reason
        });

        if (!reason.retryable) {
          return {
            status: 'non_retryable',
            error,
            attempts,
            attemptCount: attempts.length,
            retryCount: attempts.length - 1,
            policy,
            finalReason: reason
          };
        }

        if (!hasAttemptsRemaining) {
          return {
            status: 'exhausted',
            error,
            attempts,
            attemptCount: attempts.length,
            retryCount: attempts.length - 1,
            policy,
            finalReason: reason
          };
        }
      }
    }

    return {
      status: 'exhausted',
      attempts,
      attemptCount: attempts.length,
      retryCount: attempts.length,
      policy,
      finalReason: {
        code: 'unknown',
        message: 'Retry execution ended without a result.',
        retryable: false
      }
    };
  }
}

export function classifyRetryReason(error: unknown, policy: RetryPolicy): RetryReason {
  const code = getErrorCode(error);
  const message = error instanceof Error ? error.message : String(error);

  if (policy.nonRetryableReasons?.includes(code)) {
    return {
      code,
      message,
      retryable: false
    };
  }

  if (policy.retryableReasons && policy.retryableReasons.length > 0) {
    return {
      code,
      message,
      retryable: policy.retryableReasons.includes(code)
    };
  }

  return {
    code,
    message,
    retryable: getErrorRetryable(error) ?? true
  };
}

function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }

  if (error instanceof Error && error.name !== 'Error') {
    return error.name;
  }

  return 'unknown';
}

function getErrorRetryable(error: unknown): boolean | undefined {
  if (error && typeof error === 'object' && typeof (error as { retryable?: unknown }).retryable === 'boolean') {
    return (error as { retryable: boolean }).retryable;
  }

  return undefined;
}
