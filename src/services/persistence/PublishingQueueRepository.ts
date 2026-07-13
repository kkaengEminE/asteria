import type {
  PublishingQueueFailure,
  PublishingQueueItem,
  PublishingQueueStatus
} from '../../domain/publishingQueue/index.ts';
import type { PageRequest, PageResult, RevisionCheck, Revisioned } from './PersistenceTypes.ts';

export interface PublishingQueueQuery extends PageRequest {
  status?: PublishingQueueStatus;
  destinationType?: string;
  magazineSlug?: string;
}

export interface PublishingQueueStatusTransition extends RevisionCheck {
  status: PublishingQueueStatus;
  updatedAt: string;
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PublishingQueueRepository {
  create(item: PublishingQueueItem): Promise<Revisioned<PublishingQueueItem>>;
  getById(id: string): Promise<Revisioned<PublishingQueueItem> | undefined>;
  list(query?: PublishingQueueQuery): Promise<PageResult<Revisioned<PublishingQueueItem>>>;
  updateStatus(id: string, transition: PublishingQueueStatusTransition): Promise<Revisioned<PublishingQueueItem>>;
  recordFailure(
    id: string,
    failure: PublishingQueueFailure,
    revision?: RevisionCheck
  ): Promise<Revisioned<PublishingQueueItem>>;
  cancel(id: string, reason: string, revision?: RevisionCheck): Promise<Revisioned<PublishingQueueItem>>;
  findByIdempotencyKey(key: string): Promise<Revisioned<PublishingQueueItem> | undefined>;
}

