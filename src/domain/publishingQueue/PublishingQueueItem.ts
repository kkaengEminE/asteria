import type { ApprovalDecision } from '../approval/index.ts';
import type { PublishingPackage } from '../content/index.ts';
import type { PublishingDestination } from './PublishingDestination.ts';
import type { PublishingQueueFailure } from './PublishingQueueFailure.ts';
import type { PublishingQueueStatus } from './PublishingQueueStatus.ts';

export interface PublishingQueueItem {
  id: string;
  status: PublishingQueueStatus;
  publishingPackage: PublishingPackage;
  destination: PublishingDestination;
  approvalDecision: ApprovalDecision | 'UNKNOWN';
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  failure?: PublishingQueueFailure;
  metadata?: Record<string, unknown>;
}
