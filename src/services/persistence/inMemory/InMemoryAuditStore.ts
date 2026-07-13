import type { AuditEvent, AuditEventType } from '../../../domain/audit/index.ts';
import type { AuditEventQuery, AuditStore } from '../AuditStore.ts';
import type { PageRequest, PageResult } from '../PersistenceTypes.ts';
import { clone, pageItems } from './InMemoryRepositoryUtils.ts';

export class InMemoryAuditStore implements AuditStore {
  private readonly events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<AuditEvent> {
    this.events.push(clone(event));
    return clone(event);
  }

  async list(query: AuditEventQuery = {}): Promise<PageResult<AuditEvent>> {
    const filtered = this.events
      .filter((event) => !query.entityType || event.context.entityType === query.entityType)
      .filter((event) => !query.entityId || event.context.entityId === query.entityId)
      .filter((event) => !query.type || event.type === query.type)
      .filter((event) => !query.createdAfter || event.createdAt >= query.createdAfter)
      .filter((event) => !query.createdBefore || event.createdAt <= query.createdBefore)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(clone);

    return pageItems(filtered, query);
  }

  async filterByEntity(entityType: string, entityId: string, query: PageRequest = {}): Promise<PageResult<AuditEvent>> {
    return this.list({
      ...query,
      entityType,
      entityId
    });
  }

  async filterByEventType(type: AuditEventType, query: PageRequest = {}): Promise<PageResult<AuditEvent>> {
    return this.list({
      ...query,
      type
    });
  }
}
