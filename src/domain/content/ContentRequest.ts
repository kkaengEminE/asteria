export interface ContentRequest {
  topic: string;
  language?: string;
  audience?: string;
  tone?: string;
  magazineName?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export class ContentRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentRequestValidationError';
  }
}

export function createContentRequest(request: ContentRequest): ContentRequest {
  validateContentRequest(request);

  return {
    ...request,
    topic: request.topic.trim(),
    language: request.language?.trim(),
    audience: request.audience?.trim(),
    tone: request.tone?.trim(),
    magazineName: request.magazineName?.trim()
  };
}

export function validateContentRequest(request: ContentRequest): void {
  if (!request.topic || request.topic.trim().length === 0) {
    throw new ContentRequestValidationError('Content request requires topic.');
  }

  if (request.createdAt && Number.isNaN(Date.parse(request.createdAt))) {
    throw new ContentRequestValidationError('Content request createdAt must be a valid date string.');
  }
}
