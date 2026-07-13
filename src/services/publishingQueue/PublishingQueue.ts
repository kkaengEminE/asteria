import type { ApprovalResult } from '../../domain/approval/index.ts';
import type { PublishingPackage } from '../../domain/content/index.ts';
import type { AuditContext } from '../../domain/audit/index.ts';
import type {
  PublishingDestination,
  PublishingQueueFailure,
  PublishingQueueItem,
  PublishingQueueResult,
  PublishingQueueStatus
} from '../../domain/publishingQueue/index.ts';
import type { AuditLog } from '../auditLog/index.ts';
import type { MetricsService } from '../metrics/index.ts';

export interface PublishingQueueEnqueueInput {
  publishingPackage: PublishingPackage;
  approvalResult?: ApprovalResult;
  destination: PublishingDestination;
  metadata?: Record<string, unknown>;
  now?: string;
}

export interface PublishingQueueStorage {
  save(item: PublishingQueueItem): Promise<void>;
  get(id: string): Promise<PublishingQueueItem | null>;
  list(): Promise<PublishingQueueItem[]>;
}

export interface PublishingQueueOptions {
  storage?: PublishingQueueStorage;
  auditLog?: AuditLog;
  metricsService?: MetricsService;
}

export interface PublishingQueueTransitionOptions {
  retried?: boolean;
}

export class InMemoryPublishingQueueStorage implements PublishingQueueStorage {
  private readonly items = new Map<string, PublishingQueueItem>();

  async save(item: PublishingQueueItem): Promise<void> {
    this.items.set(item.id, item);
  }

  async get(id: string): Promise<PublishingQueueItem | null> {
    return this.items.get(id) ?? null;
  }

  async list(): Promise<PublishingQueueItem[]> {
    return [...this.items.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
}

export class PublishingQueue {
  private readonly storage: PublishingQueueStorage;
  private readonly auditLog?: AuditLog;
  private readonly metricsService?: MetricsService;
  private nextId = 1;

  constructor(storageOrOptions: PublishingQueueStorage | PublishingQueueOptions = {}) {
    if (isPublishingQueueStorage(storageOrOptions)) {
      this.storage = storageOrOptions;
      this.auditLog = undefined;
      return;
    }

    this.storage = storageOrOptions.storage ?? new InMemoryPublishingQueueStorage();
    this.auditLog = storageOrOptions.auditLog;
    this.metricsService = storageOrOptions.metricsService;
  }

  async enqueue(input: PublishingQueueEnqueueInput): Promise<PublishingQueueResult> {
    const approvalDecision = input.approvalResult?.decision ?? 'UNKNOWN';

    if (approvalDecision !== 'APPROVED') {
      this.metricsService?.incrementCounter('publishing_queue.rejected', 1, {
        tags: {
          approvalDecision
        },
        metadata: {
          destinationName: input.destination.name
        }
      });
      this.auditLog?.append({
        type: 'QUEUE_REJECTED',
        actor: {
          type: 'service',
          id: 'publishing-queue',
          name: 'PublishingQueue'
        },
        context: createQueueRejectionAuditContext(input),
        message: `Publishing package rejected from queue. Current decision: ${approvalDecision}.`,
        metadata: {
          approvalDecision,
          destinationType: input.destination.type,
          destinationName: input.destination.name
        }
      });

      return {
        status: 'rejected',
        approvalDecision,
        message: `Publishing queue requires APPROVED content. Current decision: ${approvalDecision}.`
      };
    }

    const now = input.now ?? new Date().toISOString();
    const item: PublishingQueueItem = {
      id: this.createId(),
      status: 'APPROVED',
      publishingPackage: input.publishingPackage,
      destination: {
        ...input.destination,
        dryRunOnly: input.destination.dryRunOnly ?? true
      },
      approvalDecision,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata
    };

    await this.storage.save(item);
    this.metricsService?.incrementCounter('publishing_queue.enqueued', 1, {
      tags: {
        destinationType: item.destination.type
      },
      metadata: {
        queueItemId: item.id,
        destinationName: item.destination.name
      }
    });
    this.auditLog?.append({
      type: 'QUEUE_CREATED',
      actor: {
        type: 'service',
        id: 'publishing-queue',
        name: 'PublishingQueue'
      },
      context: createQueueAuditContext(item),
      message: `Queue item created for ${item.destination.name}.`,
      metadata: {
        queueItemId: item.id,
        queueStatus: item.status,
        destinationType: item.destination.type,
        destinationName: item.destination.name,
        approvalDecision
      }
    });

    return {
      status: 'queued',
      item,
      approvalDecision,
      message: `Publishing package queued for ${item.destination.name}.`
    };
  }

  async getItem(id: string): Promise<PublishingQueueItem | null> {
    return this.storage.get(id);
  }

  async listItems(): Promise<PublishingQueueItem[]> {
    return this.storage.list();
  }

  async updateStatus(
    id: string,
    status: PublishingQueueStatus,
    now = new Date().toISOString(),
    options: PublishingQueueTransitionOptions = {}
  ): Promise<PublishingQueueResult> {
    const item = await this.storage.get(id);

    if (!item) {
      return createNotFoundResult(id);
    }

    if (!canTransition(item.status, status, options)) {
      this.metricsService?.recordFailure('publishing_queue.invalid_transition', `${item.status} -> ${status}`, {
        tags: {
          from: item.status,
          to: status
        }
      });
      return {
        status: 'invalid_transition',
        item,
        approvalDecision: item.approvalDecision,
        message: `Invalid publishing queue transition: ${item.status} -> ${status}.`
      };
    }

    const updated = {
      ...item,
      status,
      updatedAt: now
    };

    await this.storage.save(updated);
    this.metricsService?.incrementCounter('publishing_queue.status_updated', 1, {
      tags: {
        status
      },
      metadata: {
        queueItemId: updated.id
      }
    });

    return {
      status: 'updated',
      item: updated,
      approvalDecision: updated.approvalDecision,
      message: `Queue item ${id} status updated to ${status}.`
    };
  }

  async cancelItem(id: string, reason = 'Queue item cancelled.', now = new Date().toISOString()): Promise<PublishingQueueResult> {
    const item = await this.storage.get(id);

    if (!item) {
      return createNotFoundResult(id);
    }

    if (!canTransition(item.status, 'CANCELLED')) {
      return {
        status: 'invalid_transition',
        item,
        approvalDecision: item.approvalDecision,
        message: `Invalid publishing queue transition: ${item.status} -> CANCELLED.`
      };
    }

    const updated = {
      ...item,
      status: 'CANCELLED' as const,
      updatedAt: now,
      metadata: {
        ...item.metadata,
        cancellationReason: reason
      }
    };

    await this.storage.save(updated);
    this.metricsService?.incrementCounter('publishing_queue.cancelled', 1, {
      metadata: {
        queueItemId: updated.id,
        reason
      }
    });
    this.auditLog?.append({
      type: 'QUEUE_CANCELLED',
      actor: {
        type: 'service',
        id: 'publishing-queue',
        name: 'PublishingQueue'
      },
      context: createQueueAuditContext(updated),
      message: reason,
      metadata: {
        queueItemId: updated.id,
        queueStatus: updated.status,
        destinationName: updated.destination.name
      }
    });

    return {
      status: 'cancelled',
      item: updated,
      approvalDecision: updated.approvalDecision,
      message: reason
    };
  }

  async recordFailure(
    id: string,
    failure: Omit<PublishingQueueFailure, 'occurredAt'> & { occurredAt?: string },
    now = new Date().toISOString()
  ): Promise<PublishingQueueResult> {
    const item = await this.storage.get(id);

    if (!item) {
      return createNotFoundResult(id);
    }

    if (!canTransition(item.status, 'FAILED')) {
      return {
        status: 'invalid_transition',
        item,
        approvalDecision: item.approvalDecision,
        message: `Invalid publishing queue transition: ${item.status} -> FAILED.`
      };
    }

    const queueFailure: PublishingQueueFailure = {
      ...failure,
      occurredAt: failure.occurredAt ?? now
    };
    const updated = {
      ...item,
      status: 'FAILED' as const,
      updatedAt: now,
      failure: queueFailure
    };

    await this.storage.save(updated);
    this.metricsService?.recordFailure('publishing_queue.failed', queueFailure.reason, {
      tags: {
        code: queueFailure.code ?? 'unknown'
      },
      metadata: {
        queueItemId: updated.id
      }
    });
    this.auditLog?.append({
      type: 'QUEUE_FAILED',
      actor: {
        type: 'service',
        id: 'publishing-queue',
        name: 'PublishingQueue'
      },
      context: createQueueAuditContext(updated),
      message: queueFailure.reason,
      metadata: {
        queueItemId: updated.id,
        queueStatus: updated.status,
        failureCode: queueFailure.code,
        retryable: queueFailure.retryable
      }
    });

    return {
      status: 'failed',
      item: updated,
      approvalDecision: updated.approvalDecision,
      message: queueFailure.reason,
      failure: queueFailure
    };
  }

  private createId(): string {
    return `queue-${this.nextId++}`;
  }
}

export function canTransition(
  from: PublishingQueueStatus,
  to: PublishingQueueStatus,
  options: PublishingQueueTransitionOptions = {}
): boolean {
  if (from === to) {
    return true;
  }

  if (from === 'FAILED' && to === 'PENDING') {
    return options.retried === true;
  }

  const allowedTransitions: Record<PublishingQueueStatus, PublishingQueueStatus[]> = {
    PENDING: ['APPROVED', 'CANCELLED', 'FAILED'],
    NEEDS_REVIEW: [],
    APPROVED: ['SCHEDULED', 'PROCESSING', 'CANCELLED', 'FAILED'],
    SCHEDULED: ['PROCESSING', 'CANCELLED', 'FAILED'],
    PROCESSING: ['PUBLISHED', 'FAILED'],
    PUBLISHED: [],
    FAILED: ['CANCELLED'],
    CANCELLED: []
  };

  return allowedTransitions[from].includes(to);
}

function isPublishingQueueStorage(value: PublishingQueueStorage | PublishingQueueOptions): value is PublishingQueueStorage {
  return typeof (value as PublishingQueueStorage).save === 'function';
}

function createQueueAuditContext(item: PublishingQueueItem): AuditContext {
  return {
    entityId: item.id,
    entityType: 'publishingQueueItem',
    topic: item.publishingPackage.article.title,
    metadata: {
      destinationType: item.destination.type,
      destinationName: item.destination.name,
      approvalDecision: item.approvalDecision
    }
  };
}

function createQueueRejectionAuditContext(input: PublishingQueueEnqueueInput): AuditContext {
  return {
    entityId: input.publishingPackage.article.slug,
    entityType: 'publishingPackage',
    topic: input.publishingPackage.article.title,
    metadata: {
      destinationType: input.destination.type,
      destinationName: input.destination.name
    }
  };
}

function createNotFoundResult(id: string): PublishingQueueResult {
  return {
    status: 'not_found',
    approvalDecision: 'UNKNOWN',
    message: `Publishing queue item was not found: ${id}.`
  };
}
