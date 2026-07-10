import type { PublishingQueueResult } from '../publishingQueue/index.ts';
import type { RetryResult } from '../retry/index.ts';
import type { JobExecutionFailure } from './JobExecutionFailure.ts';
import type { JobExecutionStatus } from './JobExecutionStatus.ts';
import type { ScheduledJob } from './ScheduledJob.ts';
import type { ScheduledJobExecution } from './ScheduledJobExecution.ts';

export interface JobExecutionResult<T = unknown> {
  status: JobExecutionStatus;
  job?: ScheduledJob;
  execution?: ScheduledJobExecution;
  value?: T;
  due: boolean;
  attemptCount: number;
  retryCount: number;
  queueResult?: PublishingQueueResult;
  retryResult?: RetryResult<T>;
  failure?: JobExecutionFailure;
  message: string;
}
