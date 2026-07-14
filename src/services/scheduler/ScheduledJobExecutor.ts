import type { AuditLog } from '../auditLog/index.ts';
import type { PublishingQueue } from '../publishingQueue/index.ts';
import { RetryService } from '../retry/index.ts';
import type { PublisherService } from '../publisher/index.ts';
import type { MetricsService } from '../metrics/index.ts';
import type { PublishRequest, PublishResult } from '../../domain/publisher/index.ts';
import type { RetryPolicy } from '../../domain/retry/index.ts';
import type {
  IdempotencyStore,
  JobExecutionRepository,
  LockManager,
  TransactionContext,
  UnitOfWork
} from '../persistence/index.ts';
import type {
  JobExecutionFailure,
  JobExecutionResult,
  ScheduledJob,
  ScheduledJobExecution
} from '../../domain/scheduler/index.ts';

export interface ScheduledJobReader {
  get(id: string): Promise<ScheduledJob | null>;
}

export interface ScheduledJobExecutionStorage {
  save(execution: ScheduledJobExecution): Promise<void>;
  list(): Promise<ScheduledJobExecution[]>;
}

export interface ScheduledJobExecutorOptions {
  scheduler: ScheduledJobReader;
  queue: PublishingQueue;
  repository?: JobExecutionRepository;
  storage?: ScheduledJobExecutionStorage;
  idempotencyStore?: IdempotencyStore;
  lockManager?: LockManager;
  auditLog?: AuditLog;
  retryService?: RetryService;
  publisherService?: PublisherService;
  metricsService?: MetricsService;
  unitOfWork?: UnitOfWork;
}

export interface ExecuteScheduledJobInput<T> {
  jobId: string;
  operation?: (attemptNumber: number) => Promise<T> | T;
  publishRequest?: PublishRequest;
  retryPolicy?: Partial<RetryPolicy>;
  now?: string;
  metadata?: Record<string, unknown>;
}

export class InMemoryScheduledJobExecutionStorage implements ScheduledJobExecutionStorage {
  private readonly executions: ScheduledJobExecution[] = [];

  async save(execution: ScheduledJobExecution): Promise<void> {
    const existingIndex = this.executions.findIndex((existing) => existing.id === execution.id);

    if (existingIndex >= 0) {
      this.executions[existingIndex] = execution;
      return;
    }

    this.executions.push(execution);
  }

  async list(): Promise<ScheduledJobExecution[]> {
    return [...this.executions].sort((left, right) =>
      (left.startedAt ?? left.completedAt ?? '').localeCompare(right.startedAt ?? right.completedAt ?? '')
    );
  }
}

export class ScheduledJobExecutor {
  private readonly scheduler: ScheduledJobReader;
  private readonly queue: PublishingQueue;
  private readonly repository: JobExecutionRepository;
  private readonly idempotencyStore: IdempotencyStore;
  private readonly lockManager: LockManager;
  private readonly auditLog?: AuditLog;
  private readonly retryService: RetryService;
  private readonly publisherService?: PublisherService;
  private readonly metricsService?: MetricsService;
  private readonly unitOfWork?: UnitOfWork;
  private nextId = 1;

  constructor(options: ScheduledJobExecutorOptions) {
    this.scheduler = options.scheduler;
    this.queue = options.queue;
    this.repository = options.repository
      ?? (options.storage ? new ScheduledJobExecutionStorageRepositoryAdapter(options.storage) : requireJobExecutionRepository());
    this.idempotencyStore = options.idempotencyStore ?? requireIdempotencyStore();
    this.lockManager = options.lockManager ?? requireLockManager();
    this.auditLog = options.auditLog;
    this.retryService = options.retryService ?? new RetryService();
    this.publisherService = options.publisherService;
    this.metricsService = options.metricsService;
    this.unitOfWork = options.unitOfWork;
  }

  isDue(job: ScheduledJob, now = new Date().toISOString()): boolean {
    return Date.parse(job.scheduledFor) <= Date.parse(now);
  }

  async execute<T>(input: ExecuteScheduledJobInput<T>): Promise<JobExecutionResult<T>> {
    const now = input.now ?? new Date().toISOString();
    const startedAt = Date.now();
    const job = await this.scheduler.get(input.jobId);

    if (!job) {
      return this.skip<T>({
        job,
        due: false,
        message: `Scheduled job was not found: ${input.jobId}.`,
        failure: {
          code: 'job_not_found',
          reason: `Scheduled job was not found: ${input.jobId}.`,
          retryable: false
        },
        now,
        metadata: input.metadata
      });
    }

    const due = this.isDue(job, now);

    if (job.status === 'CANCELLED') {
      return this.skip<T>({
        job,
        due,
        message: `Scheduled job ${job.id} is cancelled.`,
        failure: {
          code: 'job_cancelled',
          reason: `Scheduled job ${job.id} is cancelled.`,
          retryable: false
        },
        now,
        metadata: input.metadata
      });
    }

    if (!due) {
      return this.skip<T>({
        job,
        due,
        message: `Scheduled job ${job.id} is not due yet.`,
        failure: {
          code: 'job_not_due',
          reason: `Scheduled job ${job.id} is not due yet.`,
          retryable: false
        },
        now,
        metadata: input.metadata
      });
    }

    const duplicate = await this.findDuplicateExecution(job.id);

    if (duplicate) {
      return this.skip<T>({
        job,
        due,
        message: `Scheduled job ${job.id} already has a ${duplicate.status} execution.`,
        failure: {
          code: 'duplicate_execution',
          reason: `Scheduled job ${job.id} already has a ${duplicate.status} execution.`,
          retryable: false
        },
        now,
        metadata: input.metadata
      });
    }

    const idempotencyKey = createExecutionIdempotencyKey(job.id);
    const existingClaim = await this.idempotencyStore.get(idempotencyKey, 'scheduled-job-execution');

    if (existingClaim && (existingClaim.status === 'CLAIMED' || existingClaim.status === 'COMPLETED')) {
      return this.skip<T>({
        job,
        due,
        message: `Scheduled job ${job.id} already has an active execution claim.`,
        failure: {
          code: 'duplicate_execution',
          reason: `Scheduled job ${job.id} already has an active execution claim.`,
          retryable: false
        },
        now,
        metadata: input.metadata
      });
    }

    const lock = await this.lockManager.acquire(idempotencyKey, 'scheduled-job-executor', 30000, now);

    if (!lock) {
      return this.skip<T>({
        job,
        due,
        message: `Scheduled job ${job.id} is locked by another execution.`,
        failure: {
          code: 'duplicate_execution',
          reason: `Scheduled job ${job.id} is locked by another execution.`,
          retryable: false
        },
        now,
        metadata: input.metadata
      });
    }

    let lockReleased = false;
    let idempotencyFinalized = false;
    const releaseLock = async () => {
      if (!lockReleased) {
        await this.lockManager.release(lock);
        lockReleased = true;
      }
    };
    const failClaim = async (failure: JobExecutionFailure) => {
      if (!idempotencyFinalized) {
        try {
          await this.idempotencyStore.fail(idempotencyKey, 'scheduled-job-execution', {
            reason: failure.reason,
            code: failure.code,
            retryable: failure.retryable
          });
        } catch (error) {
          if (!isMissingIdempotencyRecordError(error)) {
            throw error;
          }
        }
        idempotencyFinalized = true;
      }
    };
    const completeClaim = async (resultReference: string) => {
      if (!idempotencyFinalized) {
        await this.idempotencyStore.complete(idempotencyKey, 'scheduled-job-execution', resultReference);
        idempotencyFinalized = true;
      }
    };

    try {
      const start = await this.runInTransaction(async () => {
        await this.idempotencyStore.claim(idempotencyKey, 'scheduled-job-execution', {
          jobId: job.id,
          queueItemId: job.queueItemId
        });

        const queueItem = await this.queue.getItem(job.queueItemId);

        if (!queueItem || queueItem.status !== 'SCHEDULED') {
          const failure = {
            code: 'invalid_queue_status',
            reason: `Execution requires SCHEDULED queue item status. Current status: ${queueItem?.status ?? 'MISSING'}.`,
            retryable: false
          };

          await failClaim(failure);
          await releaseLock();

          return {
            status: 'invalid_queue_status' as const,
            failure
          };
        }

        const execution: ScheduledJobExecution = {
          id: await this.createId(),
          jobId: job.id,
          queueItemId: job.queueItemId,
          status: 'RUNNING',
          due,
          attemptCount: 0,
          retryCount: 0,
          startedAt: now,
          metadata: input.metadata
        };

        await this.repository.createExecution(execution);
        const queueResult = await this.queue.updateStatus(job.queueItemId, 'PROCESSING', now);

        if (queueResult.status !== 'updated') {
          const failure = {
            code: 'queue_transition_failed',
            reason: queueResult.message,
            retryable: false
          };
          const failedExecution = await this.finishExecution(execution, 'FAILED', failure, now);
          await failClaim(failure);
          await releaseLock();

          return {
            status: 'queue_transition_failed' as const,
            execution: failedExecution,
            queueResult,
            failure
          };
        }

        return {
          status: 'started' as const,
          execution,
          queueResult
        };
      });

      if (start.status === 'invalid_queue_status') {
        return this.skip<T>({
          job,
          due,
          message: start.failure.reason,
          failure: start.failure,
          now,
          metadata: input.metadata
        });
      }

      if (start.status === 'queue_transition_failed') {
        return {
          status: 'FAILED',
          job,
          execution: start.execution,
          due,
          attemptCount: 0,
          retryCount: 0,
          queueResult: start.queueResult,
          failure: start.failure,
          message: start.failure.reason
        };
      }

      const { execution, queueResult } = start;
      this.metricsService?.incrementCounter('scheduled_job_execution.started', 1, {
        metadata: {
          jobId: job.id,
          queueItemId: job.queueItemId
        }
      });
      this.auditLog?.append({
        type: 'JOB_EXECUTION_STARTED',
        actor: createExecutorActor(),
        context: createExecutionAuditContext(job),
        message: `Scheduled job execution started for ${job.id}.`,
        metadata: {
          executionId: execution.id,
          queueItemId: job.queueItemId
        }
      });

      const retryResult = await this.retryService.execute(this.createExecutionOperation(input), {
        policy: input.retryPolicy,
        now: () => now
      });

      if (retryResult.status === 'success') {
        const succeeded = await this.runInTransaction(async () => {
          const finished = await this.finishExecution(execution, 'SUCCEEDED', undefined, now, {
            attemptCount: retryResult.attemptCount,
            retryCount: retryResult.retryCount
          });
          await completeClaim(finished.id);
          await releaseLock();
          return finished;
        });

        this.auditLog?.append({
          type: 'JOB_EXECUTION_SUCCEEDED',
          actor: createExecutorActor(),
          context: createExecutionAuditContext(job),
          message: `Scheduled job execution succeeded for ${job.id}. Publishing remains disabled.`,
          metadata: {
            executionId: succeeded.id,
            attemptCount: retryResult.attemptCount,
            retryCount: retryResult.retryCount
          }
        });
        this.metricsService?.incrementCounter('scheduled_job_execution.succeeded', 1, {
          metadata: {
            jobId: job.id,
            queueItemId: job.queueItemId
          }
        });
        this.metricsService?.recordDuration('scheduled_job_execution.duration_ms', Date.now() - startedAt, {
          metadata: {
            jobId: job.id
          }
        });
        return {
          status: 'SUCCEEDED',
          job,
          execution: succeeded,
          value: retryResult.value,
          due,
          attemptCount: retryResult.attemptCount,
          retryCount: retryResult.retryCount,
          queueResult,
          retryResult,
          message: `Scheduled job ${job.id} execution preview succeeded. Publishing remains disabled.`
        };
      }

      const failure = createFailureFromRetryResult(retryResult.finalReason);
      this.metricsService?.recordFailure('scheduled_job_execution.failed', failure.reason, {
        tags: {
          code: failure.code ?? 'unknown'
        },
        metadata: {
          jobId: job.id,
          queueItemId: job.queueItemId
        }
      });
      const failed = await this.runInTransaction(async () => {
        const finished = await this.finishExecution(execution, 'FAILED', failure, now, {
          attemptCount: retryResult.attemptCount,
          retryCount: retryResult.retryCount
        });
        await this.queue.recordFailure(job.queueItemId, {
          code: failure.code,
          reason: failure.reason,
          retryable: failure.retryable
        }, now);
        await failClaim(failure);
        await releaseLock();
        return finished;
      });
      this.auditLog?.append({
        type: 'JOB_EXECUTION_FAILED',
        actor: createExecutorActor(),
        context: createExecutionAuditContext(job),
        message: failure.reason,
        metadata: {
          executionId: failed.id,
          attemptCount: retryResult.attemptCount,
          retryCount: retryResult.retryCount,
          failureCode: failure.code
        }
      });
      await failClaim(failure);
      await releaseLock();

      return {
        status: 'FAILED',
        job,
        execution: failed,
        due,
        attemptCount: retryResult.attemptCount,
        retryCount: retryResult.retryCount,
        queueResult,
        retryResult,
        failure,
        message: failure.reason
      };
    } catch (error) {
      const failure = createFailureFromUnknownError(error);
      await this.runInTransaction(async () => {
        await failClaim(failure);
        await releaseLock();
      });
      return this.skip<T>({
        job,
        due,
        message: failure.reason,
        failure,
        now,
        metadata: input.metadata
      });
    }
  }

  private async findDuplicateExecution(jobId: string): Promise<ScheduledJobExecution | undefined> {
    return (await this.repository.findActiveByJobId(jobId))?.value;
  }

  private createExecutionOperation<T>(input: ExecuteScheduledJobInput<T>): (attemptNumber: number) => Promise<T> | T {
    if (input.publishRequest) {
      if (!this.publisherService) {
        return () => {
          const error = new Error('Scheduled publishing execution requires PublisherService.');
          (error as Error & { code: string; retryable: boolean }).code = 'publisher_service_missing';
          (error as Error & { code: string; retryable: boolean }).retryable = false;
          throw error;
        };
      }

      return async () => this.publisherService!.publish(input.publishRequest!) as Promise<T & PublishResult>;
    }

    if (input.operation) {
      return input.operation;
    }

    return () => {
      const error = new Error('Scheduled job execution requires an operation or publish request.');
      (error as Error & { code: string; retryable: boolean }).code = 'execution_operation_missing';
      (error as Error & { code: string; retryable: boolean }).retryable = false;
      throw error;
    };
  }

  private async skip<T>(input: {
    job?: ScheduledJob | null;
    due: boolean;
    message: string;
    failure: JobExecutionFailure;
    now: string;
    metadata?: Record<string, unknown>;
  }): Promise<JobExecutionResult<T>> {
    const execution: ScheduledJobExecution = {
      id: await this.createId(),
      jobId: input.job?.id ?? 'unknown',
      queueItemId: input.job?.queueItemId,
      status: 'SKIPPED',
      due: input.due,
      attemptCount: 0,
      retryCount: 0,
      completedAt: input.now,
      failure: input.failure,
      metadata: input.metadata
    };

    await this.repository.createExecution(execution);
    this.metricsService?.incrementCounter('scheduled_job_execution.skipped', 1, {
      tags: {
        reason: input.failure.code ?? 'unknown'
      },
      metadata: {
        jobId: execution.jobId
      }
    });
    this.auditLog?.append({
      type: 'JOB_EXECUTION_SKIPPED',
      actor: createExecutorActor(),
      context: input.job ? createExecutionAuditContext(input.job) : { entityId: execution.jobId, entityType: 'scheduledJob' },
      message: input.message,
      metadata: {
        executionId: execution.id,
        failureCode: input.failure.code
      }
    });

    return {
      status: 'SKIPPED',
      job: input.job ?? undefined,
      execution,
      due: input.due,
      attemptCount: 0,
      retryCount: 0,
      failure: input.failure,
      message: input.message
    };
  }

  private async finishExecution(
    execution: ScheduledJobExecution,
    status: 'SUCCEEDED' | 'FAILED',
    failure: JobExecutionFailure | undefined,
    now: string,
    metadata: { attemptCount?: number; retryCount?: number } = {}
  ): Promise<ScheduledJobExecution> {
    const finished = {
      ...execution,
      status,
      attemptCount: metadata.attemptCount ?? execution.attemptCount,
      retryCount: metadata.retryCount ?? execution.retryCount,
      completedAt: now,
      failure
    };

    await this.repository.createExecution(finished);

    return finished;
  }

  private async createId(): Promise<string> {
    while (true) {
      const id = `execution-${this.nextId++}`;
      const existing = await this.repository.getById(id);

      if (!existing) {
        return id;
      }
    }
  }

  private async runInTransaction<T>(callback: (context: TransactionContext) => Promise<T>): Promise<T> {
    if (this.unitOfWork) {
      return this.unitOfWork.runInTransaction(callback);
    }

    return callback({
      id: 'scheduled-job-executor-inline-transaction',
      metadata: {
        fallback: true
      }
    });
  }
}

class ScheduledJobExecutionStorageRepositoryAdapter implements JobExecutionRepository {
  private readonly storage: ScheduledJobExecutionStorage;

  constructor(storage: ScheduledJobExecutionStorage) {
    this.storage = storage;
  }

  async createExecution(execution: ScheduledJobExecution) {
    await this.storage.save(execution);
    return { value: execution, revision: 1 };
  }

  async getById(id: string) {
    const execution = (await this.storage.list()).find((candidate) => candidate.id === id);
    return execution ? { value: execution, revision: 1 } : undefined;
  }

  async list() {
    const executions = await this.storage.list();
    return {
      items: executions.map((execution) => ({ value: execution, revision: 1 }))
    };
  }

  async findActiveByJobId(jobId: string) {
    const execution = (await this.storage.list()).find(
      (candidate) => candidate.jobId === jobId && (candidate.status === 'RUNNING' || candidate.status === 'SUCCEEDED')
    );
    return execution ? { value: execution, revision: 1 } : undefined;
  }

  async recordSuccess(id: string, result: JobExecutionResult) {
    const execution = await this.require(id);
    const updated = {
      ...execution,
      status: 'SUCCEEDED' as const,
      attemptCount: result.attemptCount,
      retryCount: result.retryCount,
      completedAt: new Date().toISOString(),
      failure: undefined
    };
    await this.storage.save(updated);
    return { value: updated, revision: 1 };
  }

  async recordFailure(id: string, failure: JobExecutionFailure) {
    const execution = await this.require(id);
    const updated = {
      ...execution,
      status: 'FAILED' as const,
      completedAt: new Date().toISOString(),
      failure
    };
    await this.storage.save(updated);
    return { value: updated, revision: 1 };
  }

  async recordSkipped(id: string, reason: string) {
    const execution = await this.require(id);
    const updated = {
      ...execution,
      status: 'SKIPPED' as const,
      completedAt: new Date().toISOString(),
      failure: execution.failure ?? {
        code: 'execution_skipped',
        reason,
        retryable: false
      }
    };
    await this.storage.save(updated);
    return { value: updated, revision: 1 };
  }

  private async require(id: string): Promise<ScheduledJobExecution> {
    const execution = (await this.storage.list()).find((candidate) => candidate.id === id);

    if (!execution) {
      throw new Error(`Scheduled job execution was not found: ${id}.`);
    }

    return execution;
  }
}

function createExecutionIdempotencyKey(jobId: string): string {
  return `scheduled-job:${jobId}`;
}

function requireJobExecutionRepository(): never {
  throw new Error('ScheduledJobExecutor requires a JobExecutionRepository. Use PersistenceCompositionFactory in runtime composition.');
}

function requireIdempotencyStore(): never {
  throw new Error('ScheduledJobExecutor requires an IdempotencyStore. Use PersistenceCompositionFactory in runtime composition.');
}

function requireLockManager(): never {
  throw new Error('ScheduledJobExecutor requires a LockManager. Use PersistenceCompositionFactory in runtime composition.');
}

function createFailureFromRetryResult(reason: { code: string; message: string; retryable: boolean } | undefined): JobExecutionFailure {
  return {
    code: reason?.code ?? 'execution_failed',
    reason: reason?.message ?? 'Scheduled job execution failed.',
    retryable: reason?.retryable
  };
}

function createFailureFromUnknownError(error: unknown): JobExecutionFailure {
  const candidate = error as Error & { code?: string; retryable?: boolean };

  return {
    code: candidate.code ?? 'execution_failed',
    reason: error instanceof Error ? error.message : String(error),
    retryable: candidate.retryable ?? false
  };
}

function isMissingIdempotencyRecordError(error: unknown): boolean {
  return error instanceof Error && /Idempotency record not found/i.test(error.message);
}

function createExecutorActor() {
  return {
    type: 'service' as const,
    id: 'scheduled-job-executor',
    name: 'ScheduledJobExecutor'
  };
}

function createExecutionAuditContext(job: ScheduledJob) {
  return {
    entityId: job.id,
    entityType: 'scheduledJob',
    metadata: {
      queueItemId: job.queueItemId,
      scheduledFor: job.scheduledFor
    }
  };
}
