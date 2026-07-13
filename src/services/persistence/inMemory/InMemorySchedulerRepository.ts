import type { SchedulePolicy, ScheduledJob } from '../../../domain/scheduler/index.ts';
import type { RevisionCheck, Revisioned, PageResult } from '../PersistenceTypes.ts';
import type { SchedulerQuery, SchedulerRepository } from '../SchedulerRepository.ts';
import { cloneRevisioned, createRevisioned, nextRevision, pageItems } from './InMemoryRepositoryUtils.ts';

export class InMemorySchedulerRepository implements SchedulerRepository {
  private readonly jobs = new Map<string, Revisioned<ScheduledJob>>();

  async create(job: ScheduledJob): Promise<Revisioned<ScheduledJob>> {
    const record = createRevisioned(job);
    this.jobs.set(job.id, record);
    return cloneRevisioned(record);
  }

  async getById(id: string): Promise<Revisioned<ScheduledJob> | undefined> {
    const record = this.jobs.get(id);
    return record ? cloneRevisioned(record) : undefined;
  }

  async list(query: SchedulerQuery = {}): Promise<PageResult<Revisioned<ScheduledJob>>> {
    const filtered = [...this.jobs.values()]
      .filter((record) => !query.status || record.value.status === query.status)
      .filter((record) => !query.queueItemId || record.value.queueItemId === query.queueItemId)
      .filter((record) => !query.dueBefore || Date.parse(record.value.scheduledFor) <= Date.parse(query.dueBefore))
      .sort((left, right) => left.value.createdAt.localeCompare(right.value.createdAt))
      .map(cloneRevisioned);

    return pageItems(filtered, query);
  }

  async findActiveByQueueItemId(queueItemId: string): Promise<Revisioned<ScheduledJob> | undefined> {
    const record = [...this.jobs.values()].find(
      (candidate) => candidate.value.queueItemId === queueItemId && candidate.value.status === 'SCHEDULED'
    );

    return record ? cloneRevisioned(record) : undefined;
  }

  async reschedule(id: string, policy: SchedulePolicy, revision?: RevisionCheck): Promise<Revisioned<ScheduledJob>> {
    const current = this.require(id);
    const now = new Date().toISOString();
    const updated = nextRevision(current, {
      ...current.value,
      policy,
      scheduledFor: policy.scheduledFor,
      updatedAt: now,
      metadata: {
        ...current.value.metadata,
        previousScheduledFor: current.value.scheduledFor
      }
    }, revision);

    this.jobs.set(id, updated);
    return cloneRevisioned(updated);
  }

  async cancel(id: string, reason: string, revision?: RevisionCheck): Promise<Revisioned<ScheduledJob>> {
    const current = this.require(id);
    const now = new Date().toISOString();
    const updated = nextRevision(current, {
      ...current.value,
      status: 'CANCELLED',
      updatedAt: now,
      cancelledAt: now,
      metadata: {
        ...current.value.metadata,
        cancellationReason: reason
      }
    }, revision);

    this.jobs.set(id, updated);
    return cloneRevisioned(updated);
  }

  async markCompleted(id: string, revision?: RevisionCheck): Promise<Revisioned<ScheduledJob>> {
    const current = this.require(id);
    const now = new Date().toISOString();
    const updated = nextRevision(current, {
      ...current.value,
      status: 'COMPLETED',
      updatedAt: now,
      metadata: {
        ...current.value.metadata,
        completedAt: now
      }
    }, revision);

    this.jobs.set(id, updated);
    return cloneRevisioned(updated);
  }

  private require(id: string): Revisioned<ScheduledJob> {
    const record = this.jobs.get(id);

    if (!record) {
      throw new Error(`Scheduled job was not found: ${id}.`);
    }

    return record;
  }
}
