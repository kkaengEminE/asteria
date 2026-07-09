export type StructuredOutputErrorCode =
  | 'EmptyResponse'
  | 'InvalidJson'
  | 'MissingRequiredField'
  | 'ValidationFailed';

export interface StructuredOutputErrorOptions {
  code: StructuredOutputErrorCode;
  message: string;
  recoverable?: boolean;
  details?: string[];
}

export class StructuredOutputError extends Error {
  readonly code: StructuredOutputErrorCode;
  readonly recoverable: boolean;
  readonly details: string[];

  constructor(options: StructuredOutputErrorOptions) {
    super(options.message);
    this.name = 'StructuredOutputError';
    this.code = options.code;
    this.recoverable = options.recoverable ?? true;
    this.details = options.details ?? [];
  }
}

export function isRecoverableStructuredOutputError(error: unknown): boolean {
  return error instanceof StructuredOutputError && error.recoverable;
}
