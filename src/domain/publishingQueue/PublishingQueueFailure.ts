export interface PublishingQueueFailure {
  reason: string;
  code?: string;
  retryable?: boolean;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}
