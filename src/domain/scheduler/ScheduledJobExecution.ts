import type { JobExecutionFailure } from './JobExecutionFailure.ts';
import type { JobExecutionStatus } from './JobExecutionStatus.ts';

export interface ScheduledJobExecution {
  id: string;
  jobId: string;
  queueItemId?: string;
  status: JobExecutionStatus;
  due: boolean;
  attemptCount: number;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
  failure?: JobExecutionFailure;
  metadata?: Record<string, unknown>;
}
