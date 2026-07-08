export type AIErrorCode =
  | 'RateLimit'
  | 'Authentication'
  | 'Timeout'
  | 'InvalidRequest'
  | 'ProviderUnavailable'
  | 'Unknown';

export class AIProviderError extends Error {
  readonly code: AIErrorCode;
  readonly provider?: string;
  readonly retryable: boolean;
  readonly metadata?: Record<string, unknown>;

  constructor(
    code: AIErrorCode,
    message: string,
    options: {
      provider?: string;
      retryable?: boolean;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.provider = options.provider;
    this.retryable = options.retryable ?? isRetryableAIError(code);
    this.metadata = options.metadata;
  }
}

export function isRetryableAIError(code: AIErrorCode): boolean {
  return code === 'RateLimit' || code === 'Timeout' || code === 'ProviderUnavailable';
}
