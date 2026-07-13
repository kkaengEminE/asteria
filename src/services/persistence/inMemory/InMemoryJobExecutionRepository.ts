import type {
  JobExecutionFailure,
  JobExecutionResult,
  ScheduledJobExecution
} from '../../../domain/scheduler/index.ts';
import type { JobExecutionQuery, JobExecutionRepository } from '../JobExecutionRepository.ts';
import type { PageResult, RevisionCheck, Revisioned } from '../PersistenceTypes.ts';
import { cloneRevisioned, createRevisioned, nextRevision, pageItems } from './InMemoryRepositoryUtils.ts';

export class InMemoryJobExecutionRepository implements JobExecutionRepository {
  private readonly executions = new Map<string, Revisioned<ScheduledJobExecution>>();

  async createExecution(execution: ScheduledJobExecution): Promise<Revisioned<ScheduledJobExecution>> {
    const existing = this.executions.get(execution.id);

    if (existing) {
      const updated = nextRevision(existing, execution);
      this.executions.set(execution.id, updated);
      return cloneRevisioned(updated);
    }

    const record = createRevisioned(execution);
    this.executions.set(execution.id, record);
    return cloneRevisioned(record);
  }

  async getById(id: string): Promise<Revisioned<ScheduledJobExecution> | undefined> {
    const record = this.executions.get(id);
    return record ? cloneRevisioned(record) : undefined;
  }

  async list(query: JobExecutionQuery = {}): Promise<PageResult<Revisioned<ScheduledJobExecution>>> {
    const filtered = [...this.executions.values()]
      .filter((record) => !query.jobId || record.value.jobId === query.jobId)
      .filter((record) => !query.queueItemId || record.value.queueItemId === query.queueItemId)
      .filter((record) => !query.status || record.value.status === query.status)
      .sort((left, right) =>
        (left.value.startedAt ?? left.value.completedAt ?? '').localeCompare(
          right.value.startedAt ?? right.value.completedAt ?? ''
        )
      )
      .map(cloneRevisioned);

    return pageItems(filtered, query);
  }

  async findActiveByJobId(jobId: string): Promise<Revisioned<ScheduledJobExecution> | undefined> {
    const record = [...this.executions.values()].find(
      (candidate) => candidate.value.jobId === jobId && (candidate.value.status === 'RUNNING' || candidate.value.status === 'SUCCEEDED')
    );

    return record ? cloneRevisioned(record) : undefined;
  }

  async recordSuccess(
    id: string,
    result: JobExecutionResult,
    revision?: RevisionCheck
  ): Promise<Revisioned<ScheduledJobExecution>> {
    const current = this.require(id);
    const updated = nextRevision(current, {
      ...current.value,
      status: 'SUCCEEDED',
      attemptCount: result.attemptCount,
      retryCount: result.retryCount,
      completedAt: current.value.completedAt ?? new Date().toISOString(),
      failure: undefined
    }, revision);

    this.executions.set(id, updated);
    return cloneRevisioned(updated);
  }

  async recordFailure(
    id: string,
    failure: JobExecutionFailure,
    revision?: RevisionCheck
  ): Promise<Revisioned<ScheduledJobExecution>> {
    const current = this.require(id);
    const updated = nextRevision(current, {
      ...current.value,
      status: 'FAILED',
      completedAt: current.value.completedAt ?? new Date().toISOString(),
      failure
    }, revision);

    this.executions.set(id, updated);
    return cloneRevisioned(updated);
  }

  async recordSkipped(id: string, reason: string, revision?: RevisionCheck): Promise<Revisioned<ScheduledJobExecution>> {
    const current = this.require(id);
    const updated = nextRevision(current, {
      ...current.value,
      status: 'SKIPPED',
      completedAt: current.value.completedAt ?? new Date().toISOString(),
      failure: current.value.failure ?? {
        code: 'execution_skipped',
        reason,
        retryable: false
      }
    }, revision);

    this.executions.set(id, updated);
    return cloneRevisioned(updated);
  }

  private require(id: string): Revisioned<ScheduledJobExecution> {
    const record = this.executions.get(id);

    if (!record) {
      throw new Error(`Scheduled job execution was not found: ${id}.`);
    }

    return record;
  }
}
