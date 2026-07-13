import type { SchedulePolicy, ScheduleStatus, ScheduledJob } from '../../domain/scheduler/index.ts';
import type { PageRequest, PageResult, RevisionCheck, Revisioned } from './PersistenceTypes.ts';

export interface SchedulerQuery extends PageRequest {
  status?: ScheduleStatus;
  queueItemId?: string;
  dueBefore?: string;
}

export interface SchedulerRepository {
  create(job: ScheduledJob): Promise<Revisioned<ScheduledJob>>;
  getById(id: string): Promise<Revisioned<ScheduledJob> | undefined>;
  list(query?: SchedulerQuery): Promise<PageResult<Revisioned<ScheduledJob>>>;
  findActiveByQueueItemId(queueItemId: string): Promise<Revisioned<ScheduledJob> | undefined>;
  reschedule(id: string, policy: SchedulePolicy, revision?: RevisionCheck): Promise<Revisioned<ScheduledJob>>;
  cancel(id: string, reason: string, revision?: RevisionCheck): Promise<Revisioned<ScheduledJob>>;
  markCompleted(id: string, revision?: RevisionCheck): Promise<Revisioned<ScheduledJob>>;
}

