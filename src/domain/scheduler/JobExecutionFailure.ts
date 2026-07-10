export interface JobExecutionFailure {
  reason: string;
  code?: string;
  retryable?: boolean;
}
