export interface PublishFailure {
  code: string;
  reason: string;
  retryable?: boolean;
}
