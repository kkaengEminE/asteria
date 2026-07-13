import type {
  JobExecutionFailure,
  JobExecutionResult,
  ScheduledJobExecution
} from '../../domain/scheduler/index.ts';
import type { PageRequest, PageResult, RevisionCheck, Revisioned } from './PersistenceTypes.ts';

export interface JobExecutionQuery extends PageRequest {
  jobId?: string;
  queueItemId?: string;
  status?: ScheduledJobExecution['status'];
}

export interface JobExecutionRepository {
  createExecution(execution: ScheduledJobExecution): Promise<Revisioned<ScheduledJobExecution>>;
  getById(id: string): Promise<Revisioned<ScheduledJobExecution> | undefined>;
  list(query?: JobExecutionQuery): Promise<PageResult<Revisioned<ScheduledJobExecution>>>;
  findActiveByJobId(jobId: string): Promise<Revisioned<ScheduledJobExecution> | undefined>;
  recordSuccess(
    id: string,
    result: JobExecutionResult,
    revision?: RevisionCheck
  ): Promise<Revisioned<ScheduledJobExecution>>;
  recordFailure(
    id: string,
    failure: JobExecutionFailure,
    revision?: RevisionCheck
  ): Promise<Revisioned<ScheduledJobExecution>>;
  recordSkipped(id: string, reason: string, revision?: RevisionCheck): Promise<Revisioned<ScheduledJobExecution>>;
}

