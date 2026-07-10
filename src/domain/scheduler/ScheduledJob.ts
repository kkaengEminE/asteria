import type { SchedulePolicy } from './SchedulePolicy.ts';
import type { ScheduleStatus } from './ScheduleStatus.ts';

export interface ScheduledJob {
  id: string;
  queueItemId: string;
  status: ScheduleStatus;
  policy: SchedulePolicy;
  scheduledFor: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  metadata?: Record<string, unknown>;
}
