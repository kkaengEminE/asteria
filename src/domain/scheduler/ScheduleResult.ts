import type { PublishingQueueResult } from '../publishingQueue/index.ts';
import type { ScheduledJob } from './ScheduledJob.ts';

export type ScheduleResultStatus =
  | 'scheduled'
  | 'rescheduled'
  | 'retry_scheduled'
  | 'cancelled'
  | 'duplicate'
  | 'rejected'
  | 'not_found'
  | 'completed';

export interface ScheduleResult {
  status: ScheduleResultStatus;
  job?: ScheduledJob;
  queueResult?: PublishingQueueResult;
  message: string;
  retryCount?: number;
  operationState?: {
    scheduledJobCount?: number;
    activeJobCount?: number;
    duplicateDetected?: boolean;
    lookupSucceeded?: boolean;
    retryAttemptCount?: number;
  };
}
