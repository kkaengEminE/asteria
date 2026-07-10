export type PublishingQueueStatus =
  | 'PENDING'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED';
