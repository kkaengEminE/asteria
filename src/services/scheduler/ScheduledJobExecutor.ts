import type { AuditLog } from '../auditLog/index.ts';
import type { PublishingQueue } from '../publishingQueue/index.ts';
import { RetryService } from '../retry/index.ts';
import type { PublisherService } from '../publisher/index.ts';
import type { MetricsService } from '../metrics/index.ts';
import type { PublishRequest, PublishResult } from '../../domain/publisher/index.ts';
import type { RetryPolicy } from '../../domain/retry/index.ts';
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
  storage?: ScheduledJobExecutionStorage;
  auditLog?: AuditLog;
  retryService?: RetryService;
  publisherService?: PublisherService;
  metricsService?: MetricsService;
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
  private readonly storage: ScheduledJobExecutionStorage;
  private readonly auditLog?: AuditLog;
  private readonly retryService: RetryService;
  private readonly publisherService?: PublisherService;
  private readonly metricsService?: MetricsService;
  private nextId = 1;

  constructor(options: ScheduledJobExecutorOptions) {
    this.scheduler = options.scheduler;
    this.queue = options.queue;
    this.storage = options.storage ?? new InMemoryScheduledJobExecutionStorage();
    this.auditLog = options.auditLog;
    this.retryService = options.retryService ?? new RetryService();
    this.publisherService = options.publisherService;
    this.metricsService = options.metricsService;
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

    const queueItem = await this.queue.getItem(job.queueItemId);

    if (!queueItem || queueItem.status !== 'SCHEDULED') {
      return this.skip<T>({
        job,
        due,
        message: `Execution requires SCHEDULED queue item status. Current status: ${queueItem?.status ?? 'MISSING'}.`,
        failure: {
          code: 'invalid_queue_status',
          reason: `Execution requires SCHEDULED queue item status. Current status: ${queueItem?.status ?? 'MISSING'}.`,
          retryable: false
        },
        now,
        metadata: input.metadata
      });
    }

    const execution: ScheduledJobExecution = {
      id: this.createId(),
      jobId: job.id,
      queueItemId: job.queueItemId,
      status: 'RUNNING',
      due,
      attemptCount: 0,
      retryCount: 0,
      startedAt: now,
      metadata: input.metadata
    };

    await this.storage.save(execution);
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

    const queueResult = await this.queue.updateStatus(job.queueItemId, 'PROCESSING', now);

    if (queueResult.status !== 'updated') {
      const failure = {
        code: 'queue_transition_failed',
        reason: queueResult.message,
        retryable: false
      };
      const failedExecution = await this.finishExecution(execution, 'FAILED', failure, now);

      return {
        status: 'FAILED',
        job,
        execution: failedExecution,
        due,
        attemptCount: 0,
        retryCount: 0,
        queueResult,
        failure,
        message: queueResult.message
      };
    }

    const retryResult = await this.retryService.execute(this.createExecutionOperation(input), {
      policy: input.retryPolicy,
      now: () => now
    });

    if (retryResult.status === 'success') {
      const succeeded = await this.finishExecution(execution, 'SUCCEEDED', undefined, now, {
        attemptCount: retryResult.attemptCount,
        retryCount: retryResult.retryCount
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
    const failed = await this.finishExecution(execution, 'FAILED', failure, now, {
      attemptCount: retryResult.attemptCount,
      retryCount: retryResult.retryCount
    });
    await this.queue.recordFailure(job.queueItemId, {
      code: failure.code,
      reason: failure.reason,
      retryable: failure.retryable
    }, now);
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
  }

  private async findDuplicateExecution(jobId: string): Promise<ScheduledJobExecution | undefined> {
    return (await this.storage.list()).find(
      (execution) => execution.jobId === jobId && (execution.status === 'RUNNING' || execution.status === 'SUCCEEDED')
    );
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
      id: this.createId(),
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

    await this.storage.save(execution);
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

    await this.storage.save(finished);

    return finished;
  }

  private createId(): string {
    return `execution-${this.nextId++}`;
  }
}

function createFailureFromRetryResult(reason: { code: string; message: string; retryable: boolean } | undefined): JobExecutionFailure {
  return {
    code: reason?.code ?? 'execution_failed',
    reason: reason?.message ?? 'Scheduled job execution failed.',
    retryable: reason?.retryable
  };
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
