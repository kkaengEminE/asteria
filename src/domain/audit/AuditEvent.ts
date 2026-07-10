import type { AuditActor } from './AuditActor.ts';
import type { AuditContext } from './AuditContext.ts';
import type { AuditEventType } from './AuditEventType.ts';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  actor: AuditActor;
  context: AuditContext;
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
