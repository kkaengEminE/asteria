import type { AuditActor, AuditContext, AuditEvent, AuditEventType } from '../../domain/audit/index.ts';
import type { AuditStore } from '../persistence/index.ts';
import { InMemoryAuditStore } from '../persistence/index.ts';

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
  private readonly store?: AuditStore;
  private readonly storage?: AuditLogStorage;
  private readonly events: AuditEvent[] = [];
  private nextId = 1;

  constructor(storageOrStore: AuditLogStorage | AuditStore = new InMemoryAuditStore()) {
    if (isAuditLogStorage(storageOrStore)) {
      this.storage = storageOrStore;
      return;
    }

    this.store = storageOrStore;
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

    if (this.storage) {
      this.storage.save(event);
    } else {
      this.events.push(event);
      void this.store?.append(event);
    }

    return event;
  }

  listEvents(filter: AuditEventFilter = {}): AuditEvent[] {
    const events = this.storage
      ? this.storage.list()
      : [...this.events].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return events.filter((event) => {
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

function isAuditLogStorage(value: AuditLogStorage | AuditStore): value is AuditLogStorage {
  return typeof (value as AuditLogStorage).save === 'function';
}
