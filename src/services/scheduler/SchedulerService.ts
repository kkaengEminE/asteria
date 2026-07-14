import type { AuditLog } from '../auditLog/index.ts';
import type {
  ScheduledJob,
  SchedulePolicy,
  ScheduleResult
} from '../../domain/scheduler/index.ts';
import { validateSchedulePolicy } from '../../domain/scheduler/index.ts';
import type { PublishingQueueItem } from '../../domain/publishingQueue/index.ts';
import type { PublishingQueue } from '../publishingQueue/index.ts';
import type { MetricsService } from '../metrics/index.ts';
import { RetryService } from '../retry/index.ts';
import type { TransactionContext, SchedulerRepository, UnitOfWork } from '../persistence/index.ts';

export interface ScheduleJobInput {
  queueItem: PublishingQueueItem;
  policy: SchedulePolicy;
  metadata?: Record<string, unknown>;
  now?: string;
}

export interface RescheduleJobInput {
  id: string;
  policy: SchedulePolicy;
  reason?: string;
  now?: string;
}

export interface RetryScheduleInput extends ScheduleJobInput {
  retryPolicy?: {
    maxAttempts?: number;
    delayMs?: number;
  };
  failAttempts?: number;
}

export interface SchedulerStorage {
  save(job: ScheduledJob): Promise<void>;
  get(id: string): Promise<ScheduledJob | null>;
  list(): Promise<ScheduledJob[]>;
}

export interface SchedulerServiceOptions {
  repository?: SchedulerRepository;
  storage?: SchedulerStorage;
  auditLog?: AuditLog;
  queue?: PublishingQueue;
  metricsService?: MetricsService;
  unitOfWork?: UnitOfWork;
}

export class InMemorySchedulerStorage implements SchedulerStorage {
  private readonly jobs = new Map<string, ScheduledJob>();

  async save(job: ScheduledJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async get(id: string): Promise<ScheduledJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async list(): Promise<ScheduledJob[]> {
    return [...this.jobs.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
}

export class SchedulerService {
  private readonly repository: SchedulerRepository;
  private readonly auditLog?: AuditLog;
  private readonly queue?: PublishingQueue;
  private readonly metricsService?: MetricsService;
  private readonly unitOfWork?: UnitOfWork;
  private readonly retryService = new RetryService();
  private nextId = 1;

  constructor(options: SchedulerServiceOptions = {}) {
    this.repository = options.repository
      ?? (options.storage ? new SchedulerStorageRepositoryAdapter(options.storage) : requireSchedulerRepository());
    this.auditLog = options.auditLog;
    this.queue = options.queue;
    this.metricsService = options.metricsService;
    this.unitOfWork = options.unitOfWork;
  }

  async schedule(input: ScheduleJobInput): Promise<ScheduleResult> {
    let policy: SchedulePolicy;

    try {
      policy = validateSchedulePolicy(input.policy);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.metricsService?.recordFailure('scheduler.rejected', message, {
        tags: {
          reason: 'invalid_policy'
        }
      });

      return {
        status: 'rejected',
        message,
        operationState: await this.createOperationState()
      };
    }

    const existing = await this.findActiveJobByQueueItem(input.queueItem.id);

    if (existing) {
      this.metricsService?.incrementCounter('scheduler.duplicate', 1, {
        metadata: {
          queueItemId: input.queueItem.id,
        jobId: existing.id
        }
      });
      return {
        status: 'duplicate',
        job: existing,
        message: `Queue item ${input.queueItem.id} is already scheduled.`,
        operationState: await this.createOperationState({
          duplicateDetected: true,
          lookupSucceeded: true
        })
      };
    }

    if (input.queueItem.status !== 'APPROVED') {
      this.metricsService?.recordFailure('scheduler.rejected', `Queue item status ${input.queueItem.status}.`, {
        tags: {
          queueStatus: input.queueItem.status
        }
      });
      return {
        status: 'rejected',
        message: `Scheduling requires APPROVED queue item status. Current status: ${input.queueItem.status}.`,
        operationState: await this.createOperationState()
      };
    }

    const now = input.now ?? new Date().toISOString();
    const job: ScheduledJob = {
      id: this.createId(),
      queueItemId: input.queueItem.id,
      status: 'SCHEDULED',
      policy,
      scheduledFor: policy.scheduledFor,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata
    };
    const queueResult = await this.runInTransaction(async () => {
      const result = this.queue
        ? await this.queue.updateStatus(input.queueItem.id, 'SCHEDULED', now)
        : undefined;

      if (result && result.status !== 'updated') {
        return result;
      }

      await this.repository.create(job);
      return result;
    });

    if (queueResult && queueResult.status !== 'updated') {
      this.metricsService?.recordFailure('scheduler.rejected', queueResult.message, {
        tags: {
          reason: queueResult.status
        }
      });
      return {
        status: 'rejected',
        queueResult,
        message: queueResult.message,
        operationState: await this.createOperationState()
      };
    }
    this.metricsService?.incrementCounter('scheduler.scheduled', 1, {
      metadata: {
        jobId: job.id,
        queueItemId: job.queueItemId
      }
    });
    this.auditLog?.append({
      type: 'JOB_SCHEDULED',
      actor: {
        type: 'service',
        id: 'scheduler',
        name: 'SchedulerService'
      },
      context: {
        entityId: job.id,
        entityType: 'scheduledJob',
        topic: input.queueItem.publishingPackage.article.title,
        metadata: {
          queueItemId: job.queueItemId,
          scheduledFor: job.scheduledFor
        }
      },
      message: `Scheduled queue item ${job.queueItemId} for ${job.scheduledFor}.`,
      metadata: {
        queueItemId: job.queueItemId,
        scheduledFor: job.scheduledFor,
        timezone: job.policy.timezone
      }
    });

    return {
      status: 'scheduled',
      job,
      queueResult,
      message: `Queue item ${job.queueItemId} scheduled for ${job.scheduledFor}.`,
      operationState: await this.createOperationState({
        lookupSucceeded: true
      })
    };
  }

  async reschedule(input: RescheduleJobInput): Promise<ScheduleResult> {
    let policy: SchedulePolicy;

    try {
      policy = validateSchedulePolicy(input.policy);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.metricsService?.recordFailure('scheduler.reschedule_rejected', message, {
        tags: {
          reason: 'invalid_policy'
        }
      });

      return {
        status: 'rejected',
        message,
        operationState: await this.createOperationState()
      };
    }

    const record = await this.repository.getById(input.id);
    const job = record?.value;

    if (!job) {
      this.metricsService?.recordFailure('scheduler.reschedule_failed', `Scheduled job was not found: ${input.id}.`, {
        tags: {
          reason: 'not_found'
        }
      });
      return {
        status: 'not_found',
        message: `Scheduled job was not found: ${input.id}.`,
        operationState: await this.createOperationState({
          lookupSucceeded: false
        })
      };
    }

    if (isTerminal(job)) {
      return this.rejectImmutableJob(job, 'reschedule');
    }

    const now = input.now ?? new Date().toISOString();
    const updated: ScheduledJob = {
      ...job,
      policy,
      scheduledFor: policy.scheduledFor,
      updatedAt: now,
      metadata: {
        ...job.metadata,
        rescheduleReason: input.reason ?? 'Scheduled job rescheduled.',
        previousScheduledFor: job.scheduledFor
      }
    };

    await this.repository.reschedule(updated.id, updated.policy, {
      expectedRevision: record.revision
    });
    this.metricsService?.incrementCounter('scheduler.rescheduled', 1, {
      metadata: {
        jobId: updated.id,
        queueItemId: updated.queueItemId
      }
    });
    this.auditLog?.append({
      type: 'JOB_RESCHEDULED',
      actor: {
        type: 'service',
        id: 'scheduler',
        name: 'SchedulerService'
      },
      context: {
        entityId: updated.id,
        entityType: 'scheduledJob',
        metadata: {
          queueItemId: updated.queueItemId
        }
      },
      message: input.reason ?? `Rescheduled queue item ${updated.queueItemId} for ${updated.scheduledFor}.`,
      metadata: {
        queueItemId: updated.queueItemId,
        previousScheduledFor: job.scheduledFor,
        scheduledFor: updated.scheduledFor,
        timezone: updated.policy.timezone
      }
    });

    return {
      status: 'rescheduled',
      job: updated,
      message: `Queue item ${updated.queueItemId} rescheduled for ${updated.scheduledFor}.`,
      operationState: await this.createOperationState({
        lookupSucceeded: true
      })
    };
  }

  async retrySchedule(input: RetryScheduleInput): Promise<ScheduleResult> {
    const retryResult = await this.retryService.execute(
      async (attemptNumber) => {
        if (attemptNumber <= (input.failAttempts ?? 0)) {
          const error = new Error('Simulated scheduler retry failure.');
          (error as Error & { code: string; retryable: boolean }).code = 'scheduler_retry';
          (error as Error & { code: string; retryable: boolean }).retryable = true;
          throw error;
        }

        return this.schedule(input);
      },
      {
        policy: {
          maxAttempts: input.retryPolicy?.maxAttempts ?? 2,
          delayMs: input.retryPolicy?.delayMs ?? 25,
          retryableReasons: ['scheduler_retry']
        }
      }
    );

    if (retryResult.status !== 'success' || !retryResult.value) {
      const message = retryResult.finalReason?.message ?? 'Schedule retry exhausted.';
      this.metricsService?.recordFailure('scheduler.retry_failed', message, {
        metadata: {
          retryCount: retryResult.retryCount
        }
      });

      return {
        status: 'rejected',
        message,
        retryCount: retryResult.retryCount,
        operationState: await this.createOperationState({
          retryAttemptCount: retryResult.attemptCount
        })
      };
    }

    const scheduled = retryResult.value;
    this.metricsService?.incrementCounter('scheduler.retry_scheduled', 1, {
      metadata: {
        retryCount: retryResult.retryCount,
        jobId: scheduled.job?.id
      }
    });
    if (scheduled.job) {
      this.auditLog?.append({
        type: 'JOB_SCHEDULE_RETRIED',
        actor: {
          type: 'service',
          id: 'scheduler',
          name: 'SchedulerService'
        },
        context: {
          entityId: scheduled.job.id,
          entityType: 'scheduledJob',
          metadata: {
            queueItemId: scheduled.job.queueItemId
          }
        },
        message: `Schedule retry completed after ${retryResult.attemptCount} attempt(s).`,
        metadata: {
          retryCount: retryResult.retryCount,
          attemptCount: retryResult.attemptCount
        }
      });
    }

    return {
      ...scheduled,
      status: scheduled.status === 'scheduled' ? 'retry_scheduled' : scheduled.status,
      retryCount: retryResult.retryCount,
      operationState: {
        ...(scheduled.operationState ?? {}),
        retryAttemptCount: retryResult.attemptCount
      }
    };
  }

  async cancel(id: string, reason = 'Scheduled job cancelled.', now = new Date().toISOString()): Promise<ScheduleResult> {
    const record = await this.repository.getById(id);
    const job = record?.value;

    if (!job) {
      this.metricsService?.recordFailure('scheduler.cancel_failed', `Scheduled job was not found: ${id}.`, {
        tags: {
          reason: 'not_found'
        }
      });
      return {
        status: 'not_found',
        message: `Scheduled job was not found: ${id}.`
      };
    }

    if (job.status === 'CANCELLED') {
      return {
        status: 'cancelled',
        job,
        message: `Scheduled job ${id} is already cancelled.`
      };
    }

    if (job.status === 'COMPLETED') {
      return this.rejectImmutableJob(job, 'cancel');
    }

    const queueResult = this.queue ? await this.queue.cancelItem(job.queueItemId, reason, now) : undefined;
    const updated: ScheduledJob = {
      ...job,
      status: 'CANCELLED',
      updatedAt: now,
      cancelledAt: now,
      metadata: {
        ...job.metadata,
        cancellationReason: reason
      }
    };

    await this.repository.cancel(updated.id, reason, {
      expectedRevision: record.revision
    });
    this.metricsService?.incrementCounter('scheduler.cancelled', 1, {
      metadata: {
        jobId: updated.id,
        queueItemId: updated.queueItemId
      }
    });
    this.auditLog?.append({
      type: 'JOB_CANCELLED',
      actor: {
        type: 'service',
        id: 'scheduler',
        name: 'SchedulerService'
      },
      context: {
        entityId: updated.id,
        entityType: 'scheduledJob',
        metadata: {
          queueItemId: updated.queueItemId
        }
      },
      message: reason,
      metadata: {
        queueItemId: updated.queueItemId,
        queueResultStatus: queueResult?.status
      }
    });

    return {
      status: 'cancelled',
      job: updated,
      queueResult,
      message: reason
    };
  }

  async get(id: string): Promise<ScheduledJob | null> {
    return (await this.repository.getById(id))?.value ?? null;
  }

  async list(): Promise<ScheduledJob[]> {
    return (await this.repository.list()).items.map((record) => record.value);
  }

  async markCompleted(id: string, now = new Date().toISOString()): Promise<ScheduleResult> {
    const record = await this.repository.getById(id);
    const job = record?.value;

    if (!job) {
      return {
        status: 'not_found',
        message: `Scheduled job was not found: ${id}.`,
        operationState: await this.createOperationState({
          lookupSucceeded: false
        })
      };
    }

    if (isTerminal(job)) {
      return this.rejectImmutableJob(job, 'complete');
    }

    const updated: ScheduledJob = {
      ...job,
      status: 'COMPLETED',
      updatedAt: now,
      metadata: {
        ...job.metadata,
        completedAt: now
      }
    };

    await this.repository.markCompleted(updated.id, {
      expectedRevision: record.revision
    });

    return {
      status: 'completed',
      job: updated,
      message: `Scheduled job ${id} marked completed for scheduler operations preview.`,
      operationState: await this.createOperationState({
        lookupSucceeded: true
      })
    };
  }

  private createId(): string {
    return `schedule-${this.nextId++}`;
  }

  private async findActiveJobByQueueItem(queueItemId: string): Promise<ScheduledJob | undefined> {
    return (await this.repository.findActiveByQueueItemId(queueItemId))?.value;
  }

  private async createOperationState(overrides: NonNullable<ScheduleResult['operationState']> = {}): Promise<NonNullable<ScheduleResult['operationState']>> {
    const jobs = (await this.repository.list()).items.map((record) => record.value);

    return {
      scheduledJobCount: jobs.length,
      activeJobCount: jobs.filter((job) => job.status === 'SCHEDULED').length,
      duplicateDetected: false,
      lookupSucceeded: undefined,
      ...overrides
    };
  }

  private async rejectImmutableJob(job: ScheduledJob, operation: string): Promise<ScheduleResult> {
    const message = `Scheduled job ${job.id} is ${job.status} and cannot ${operation}.`;

    this.metricsService?.recordFailure('scheduler.immutable_job_rejected', message, {
      tags: {
        status: job.status,
        operation
      }
    });

    return {
      status: 'rejected',
      job,
      message,
      operationState: await this.createOperationState({
        lookupSucceeded: true
      })
    };
  }

  private async runInTransaction<T>(callback: (context: TransactionContext) => Promise<T>): Promise<T> {
    if (this.unitOfWork) {
      return this.unitOfWork.runInTransaction(callback);
    }

    return callback({
      id: 'scheduler-inline-transaction',
      metadata: {
        fallback: true
      }
    });
  }
}

class SchedulerStorageRepositoryAdapter implements SchedulerRepository {
  private readonly storage: SchedulerStorage;

  constructor(storage: SchedulerStorage) {
    this.storage = storage;
  }

  async create(job: ScheduledJob) {
    await this.storage.save(job);
    return { value: job, revision: 1 };
  }

  async getById(id: string) {
    const job = await this.storage.get(id);
    return job ? { value: job, revision: 1 } : undefined;
  }

  async list() {
    const jobs = await this.storage.list();
    return {
      items: jobs.map((job) => ({ value: job, revision: 1 }))
    };
  }

  async findActiveByQueueItemId(queueItemId: string) {
    const job = (await this.storage.list()).find((candidate) => candidate.queueItemId === queueItemId && candidate.status === 'SCHEDULED');
    return job ? { value: job, revision: 1 } : undefined;
  }

  async reschedule(id: string, policy: SchedulePolicy) {
    const job = await this.require(id);
    const updated = {
      ...job,
      policy,
      scheduledFor: policy.scheduledFor,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...job.metadata,
        previousScheduledFor: job.scheduledFor
      }
    };
    await this.storage.save(updated);
    return { value: updated, revision: 1 };
  }

  async cancel(id: string, reason: string) {
    const job = await this.require(id);
    const updated = {
      ...job,
      status: 'CANCELLED' as const,
      updatedAt: new Date().toISOString(),
      cancelledAt: new Date().toISOString(),
      metadata: {
        ...job.metadata,
        cancellationReason: reason
      }
    };
    await this.storage.save(updated);
    return { value: updated, revision: 1 };
  }

  async markCompleted(id: string) {
    const job = await this.require(id);
    const updated = {
      ...job,
      status: 'COMPLETED' as const,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...job.metadata,
        completedAt: new Date().toISOString()
      }
    };
    await this.storage.save(updated);
    return { value: updated, revision: 1 };
  }

  private async require(id: string): Promise<ScheduledJob> {
    const job = await this.storage.get(id);

    if (!job) {
      throw new Error(`Scheduled job was not found: ${id}.`);
    }

    return job;
  }
}

function isTerminal(job: ScheduledJob): boolean {
  return job.status === 'CANCELLED' || job.status === 'COMPLETED';
}

function requireSchedulerRepository(): never {
  throw new Error('SchedulerService requires a SchedulerRepository. Use PersistenceCompositionFactory in runtime composition.');
}
