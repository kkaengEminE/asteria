import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRetryPolicy } from '../src/domain/retry/index.ts';
import { RetryService } from '../src/services/retry/index.ts';
import { SequentialWorkflowEngine, type WorkflowStep } from '../src/workflows/index.ts';

test('retry service succeeds after retry', async () => {
  const retryService = new RetryService();
  let calls = 0;
  const result = await retryService.execute(
    () => {
      calls += 1;

      if (calls === 1) {
        throw retryableError('temporary');
      }

      return 'ok';
    },
    {
      policy: {
        maxAttempts: 2,
        delayMs: 50
      }
    }
  );

  assert.equal(result.status, 'success');
  assert.equal(result.value, 'ok');
  assert.equal(result.attemptCount, 2);
  assert.equal(result.retryCount, 1);
  assert.equal(result.attempts[0].delayMs, 50);
});

test('retry service reports retry exhaustion', async () => {
  const retryService = new RetryService();
  const result = await retryService.execute(
    () => {
      throw retryableError('still-temporary');
    },
    {
      policy: {
        maxAttempts: 3,
        delayMs: 10
      }
    }
  );

  assert.equal(result.status, 'exhausted');
  assert.equal(result.attemptCount, 3);
  assert.equal(result.retryCount, 2);
  assert.equal(result.finalReason?.retryable, true);
});

test('retry service stops on non-retryable failure', async () => {
  const retryService = new RetryService();
  const result = await retryService.execute(
    () => {
      throw nonRetryableError('bad-request');
    },
    {
      policy: {
        maxAttempts: 3,
        delayMs: 10
      }
    }
  );

  assert.equal(result.status, 'non_retryable');
  assert.equal(result.attemptCount, 1);
  assert.equal(result.retryCount, 0);
  assert.equal(result.finalReason?.retryable, false);
});

test('retry service records retry history', async () => {
  const retryService = new RetryService();
  let calls = 0;
  const result = await retryService.execute(
    () => {
      calls += 1;

      if (calls < 3) {
        throw retryableError(`temporary-${calls}`);
      }

      return 'ok';
    },
    {
      policy: {
        maxAttempts: 3,
        delayMs: 5
      },
      now: createClock([
        '2026-07-10T00:00:00.000Z',
        '2026-07-10T00:00:01.000Z',
        '2026-07-10T00:00:02.000Z',
        '2026-07-10T00:00:03.000Z',
        '2026-07-10T00:00:04.000Z',
        '2026-07-10T00:00:05.000Z'
      ])
    }
  );

  assert.deepEqual(
    result.attempts.map((attempt) => attempt.status),
    ['failed', 'failed', 'success']
  );
  assert.equal(result.attempts[0].startedAt, '2026-07-10T00:00:00.000Z');
  assert.equal(result.attempts[1].reason?.code, 'temporary-2');
});

test('retry policy enforces valid max attempts and delay', () => {
  assert.throws(() => createRetryPolicy({ maxAttempts: 0 }), /maxAttempts/);
  assert.throws(() => createRetryPolicy({ delayMs: -1 }), /delayMs/);
});

test('retry service can be used from a mocked workflow path', async () => {
  const retryService = new RetryService();
  const engine = new SequentialWorkflowEngine({ name: 'retry-proof' });
  const step: WorkflowStep = {
    name: 'Retry Proof Step',
    async execute(context) {
      let calls = 0;
      const retryResult = await retryService.execute(
        () => {
          calls += 1;

          if (calls === 1) {
            throw retryableError('mock-workflow-transient');
          }

          return 'workflow-ok';
        },
        {
          policy: {
            maxAttempts: 2,
            delayMs: 1
          }
        }
      );

      return {
        stepName: 'Retry Proof Step',
        status: 'success',
        context: {
          ...context,
          data: {
            ...context.data,
            retryResult
          }
        }
      };
    }
  };

  engine.register(step);
  const workflowResult = await engine.execute({
    workflowId: 'retry-proof',
    dryRun: true,
    data: {}
  });

  assert.equal(workflowResult.status, 'success');
  assert.equal((workflowResult.context.data.retryResult as { status?: string }).status, 'success');
});

function retryableError(code: string): Error & { code: string; retryable: boolean } {
  const error = new Error(code) as Error & { code: string; retryable: boolean };
  error.code = code;
  error.retryable = true;

  return error;
}

function nonRetryableError(code: string): Error & { code: string; retryable: boolean } {
  const error = new Error(code) as Error & { code: string; retryable: boolean };
  error.code = code;
  error.retryable = false;

  return error;
}

function createClock(values: string[]): () => string {
  let index = 0;

  return () => values[Math.min(index++, values.length - 1)];
}
