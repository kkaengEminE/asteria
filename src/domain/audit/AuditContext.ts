export interface AuditContext {
  entityId?: string;
  entityType?: string;
  workflowId?: string;
  magazineSlug?: string;
  topic?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}
