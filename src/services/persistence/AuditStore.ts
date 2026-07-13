import type { AuditEvent, AuditEventType } from '../../domain/audit/index.ts';
import type { PageRequest, PageResult } from './PersistenceTypes.ts';

export interface AuditEventQuery extends PageRequest {
  entityType?: string;
  entityId?: string;
  type?: AuditEventType;
  createdAfter?: string;
  createdBefore?: string;
}

export interface AuditStore {
  append(event: AuditEvent): Promise<AuditEvent>;
  list(query?: AuditEventQuery): Promise<PageResult<AuditEvent>>;
  filterByEntity(entityType: string, entityId: string, query?: PageRequest): Promise<PageResult<AuditEvent>>;
  filterByEventType(type: AuditEventType, query?: PageRequest): Promise<PageResult<AuditEvent>>;
}

