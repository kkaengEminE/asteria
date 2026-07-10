import type { PublishingQueueResult } from '../publishingQueue/index.ts';
import type { ScheduledJob } from './ScheduledJob.ts';

export type ScheduleResultStatus = 'scheduled' | 'cancelled' | 'duplicate' | 'rejected' | 'not_found';

export interface ScheduleResult {
  status: ScheduleResultStatus;
  job?: ScheduledJob;
  queueResult?: PublishingQueueResult;
  message: string;
}
