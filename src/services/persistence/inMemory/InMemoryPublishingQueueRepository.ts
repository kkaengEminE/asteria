import type {
  PublishingQueueFailure,
  PublishingQueueItem
} from '../../../domain/publishingQueue/index.ts';
import type {
  PublishingQueueQuery,
  PublishingQueueRepository,
  PublishingQueueStatusTransition
} from '../PublishingQueueRepository.ts';
import type { PageResult, RevisionCheck, Revisioned } from '../PersistenceTypes.ts';
import { cloneRevisioned, createRevisioned, nextRevision, pageItems } from './InMemoryRepositoryUtils.ts';

export class InMemoryPublishingQueueRepository implements PublishingQueueRepository {
  private readonly items = new Map<string, Revisioned<PublishingQueueItem>>();

  async create(item: PublishingQueueItem): Promise<Revisioned<PublishingQueueItem>> {
    const record = createRevisioned(item);
    this.items.set(item.id, record);
    return cloneRevisioned(record);
  }

  async getById(id: string): Promise<Revisioned<PublishingQueueItem> | undefined> {
    const record = this.items.get(id);
    return record ? cloneRevisioned(record) : undefined;
  }

  async list(query: PublishingQueueQuery = {}): Promise<PageResult<Revisioned<PublishingQueueItem>>> {
    const filtered = [...this.items.values()]
      .filter((record) => !query.status || record.value.status === query.status)
      .filter((record) => !query.destinationType || record.value.destination.type === query.destinationType)
      .filter((record) => !query.magazineSlug || record.value.metadata?.magazineSlug === query.magazineSlug)
      .sort((left, right) => left.value.createdAt.localeCompare(right.value.createdAt))
      .map(cloneRevisioned);

    return pageItems(filtered, query);
  }

  async updateStatus(id: string, transition: PublishingQueueStatusTransition): Promise<Revisioned<PublishingQueueItem>> {
    const current = this.require(id);
    const updated = nextRevision(current, {
      ...current.value,
      status: transition.status,
      updatedAt: transition.updatedAt,
      metadata: {
        ...current.value.metadata,
        ...transition.metadata,
        scheduledAt: transition.scheduledAt ?? current.value.metadata?.scheduledAt
      }
    }, transition);

    this.items.set(id, updated);
    return cloneRevisioned(updated);
  }

  async recordFailure(
    id: string,
    failure: PublishingQueueFailure,
    revision?: RevisionCheck
  ): Promise<Revisioned<PublishingQueueItem>> {
    const current = this.require(id);
    const updated = nextRevision(current, {
      ...current.value,
      status: 'FAILED',
      updatedAt: failure.occurredAt,
      failure
    }, revision);

    this.items.set(id, updated);
    return cloneRevisioned(updated);
  }

  async cancel(id: string, reason: string, revision?: RevisionCheck): Promise<Revisioned<PublishingQueueItem>> {
    const current = this.require(id);
    const now = new Date().toISOString();
    const updated = nextRevision(current, {
      ...current.value,
      status: 'CANCELLED',
      updatedAt: now,
      metadata: {
        ...current.value.metadata,
        cancellationReason: reason
      }
    }, revision);

    this.items.set(id, updated);
    return cloneRevisioned(updated);
  }

  async findByIdempotencyKey(key: string): Promise<Revisioned<PublishingQueueItem> | undefined> {
    const record = [...this.items.values()].find((candidate) => candidate.value.metadata?.idempotencyKey === key);
    return record ? cloneRevisioned(record) : undefined;
  }

  private require(id: string): Revisioned<PublishingQueueItem> {
    const record = this.items.get(id);

    if (!record) {
      throw new Error(`Publishing queue item was not found: ${id}.`);
    }

    return record;
  }
}
