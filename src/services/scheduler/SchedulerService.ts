import type { AuditLog } from '../auditLog/index.ts';
import type {
  ScheduledJob,
  SchedulePolicy,
  ScheduleResult
} from '../../domain/scheduler/index.ts';
import { validateSchedulePolicy } from '../../domain/scheduler/index.ts';
import type { PublishingQueueItem } from '../../domain/publishingQueue/index.ts';
import type { PublishingQueue } from '../publishingQueue/index.ts';

export interface ScheduleJobInput {
  queueItem: PublishingQueueItem;
  policy: SchedulePolicy;
  metadata?: Record<string, unknown>;
  now?: string;
}

export interface SchedulerStorage {
  save(job: ScheduledJob): Promise<void>;
  get(id: string): Promise<ScheduledJob | null>;
  list(): Promise<ScheduledJob[]>;
}

export interface SchedulerServiceOptions {
  storage?: SchedulerStorage;
  auditLog?: AuditLog;
  queue?: PublishingQueue;
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
  private readonly storage: SchedulerStorage;
  private readonly auditLog?: AuditLog;
  private readonly queue?: PublishingQueue;
  private nextId = 1;

  constructor(options: SchedulerServiceOptions = {}) {
    this.storage = options.storage ?? new InMemorySchedulerStorage();
    this.auditLog = options.auditLog;
    this.queue = options.queue;
  }

  async schedule(input: ScheduleJobInput): Promise<ScheduleResult> {
    const policy = validateSchedulePolicy(input.policy);
    const existing = (await this.storage.list()).find(
      (job) => job.queueItemId === input.queueItem.id && job.status === 'SCHEDULED'
    );

    if (existing) {
      return {
        status: 'duplicate',
        job: existing,
        message: `Queue item ${input.queueItem.id} is already scheduled.`
      };
    }

    if (input.queueItem.status !== 'APPROVED') {
      return {
        status: 'rejected',
        message: `Scheduling requires APPROVED queue item status. Current status: ${input.queueItem.status}.`
      };
    }

    const now = input.now ?? new Date().toISOString();
    const queueResult = this.queue
      ? await this.queue.updateStatus(input.queueItem.id, 'SCHEDULED', now)
      : undefined;

    if (queueResult && queueResult.status !== 'updated') {
      return {
        status: 'rejected',
        queueResult,
        message: queueResult.message
      };
    }

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

    await this.storage.save(job);
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
      message: `Queue item ${job.queueItemId} scheduled for ${job.scheduledFor}.`
    };
  }

  async cancel(id: string, reason = 'Scheduled job cancelled.', now = new Date().toISOString()): Promise<ScheduleResult> {
    const job = await this.storage.get(id);

    if (!job) {
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

    await this.storage.save(updated);
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
    return this.storage.get(id);
  }

  async list(): Promise<ScheduledJob[]> {
    return this.storage.list();
  }

  private createId(): string {
    return `schedule-${this.nextId++}`;
  }
}
