import type { ApprovalDecision } from '../approval/index.ts';
import type { PublishingQueueFailure } from './PublishingQueueFailure.ts';
import type { PublishingQueueItem } from './PublishingQueueItem.ts';

export type PublishingQueueResultStatus =
  | 'queued'
  | 'rejected'
  | 'updated'
  | 'cancelled'
  | 'failed'
  | 'not_found'
  | 'invalid_transition';

export interface PublishingQueueResult {
  status: PublishingQueueResultStatus;
  item?: PublishingQueueItem;
  approvalDecision: ApprovalDecision | 'UNKNOWN';
  message: string;
  failure?: PublishingQueueFailure;
}
