import type { AuditActor, AuditContext, AuditEvent, AuditEventType } from '../../domain/audit/index.ts';

export interface AppendAuditEventInput {
  type: AuditEventType;
  actor?: AuditActor;
  context?: AuditContext;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface AuditLogStorage {
  save(event: AuditEvent): void;
  list(): AuditEvent[];
}

export interface AuditEventFilter {
  entityId?: string;
  entityType?: string;
  type?: AuditEventType;
}

export class InMemoryAuditLogStorage implements AuditLogStorage {
  private readonly events: AuditEvent[] = [];

  save(event: AuditEvent): void {
    this.events.push(event);
  }

  list(): AuditEvent[] {
    return [...this.events].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
}

export class AuditLog {
  private readonly storage: AuditLogStorage;
  private nextId = 1;

  constructor(storage: AuditLogStorage = new InMemoryAuditLogStorage()) {
    this.storage = storage;
  }

  append(input: AppendAuditEventInput): AuditEvent {
    const event: AuditEvent = {
      id: this.createId(),
      type: input.type,
      actor: input.actor ?? {
        type: 'system',
        id: 'asteria',
        name: 'Asteria'
      },
      context: input.context ?? {},
      message: input.message,
      createdAt: input.createdAt ?? new Date().toISOString(),
      metadata: input.metadata
    };

    this.storage.save(event);

    return event;
  }

  listEvents(filter: AuditEventFilter = {}): AuditEvent[] {
    return this.storage.list().filter((event) => {
      if (filter.entityId && event.context.entityId !== filter.entityId) {
        return false;
      }

      if (filter.entityType && event.context.entityType !== filter.entityType) {
        return false;
      }

      if (filter.type && event.type !== filter.type) {
        return false;
      }

      return true;
    });
  }

  filterByEntity(entityId: string, entityType?: string): AuditEvent[] {
    return this.listEvents({ entityId, entityType });
  }

  filterByEventType(type: AuditEventType): AuditEvent[] {
    return this.listEvents({ type });
  }

  private createId(): string {
    return `audit-${this.nextId++}`;
  }
}
