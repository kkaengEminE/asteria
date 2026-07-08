import type { AIMessage } from './AIMessage.ts';

export interface AIRequest {
  systemPrompt?: string;
  userPrompt?: string;
  messages?: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

export class AIRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIRequestValidationError';
  }
}

export function validateAIRequest(request: AIRequest): void {
  const hasUserPrompt = typeof request.userPrompt === 'string' && request.userPrompt.trim().length > 0;
  const hasMessages = Array.isArray(request.messages) && request.messages.length > 0;

  if (!hasUserPrompt && !hasMessages) {
    throw new AIRequestValidationError('AI request requires userPrompt or messages.');
  }

  if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
    throw new AIRequestValidationError('AI request temperature must be between 0 and 2.');
  }

  if (request.maxTokens !== undefined && request.maxTokens <= 0) {
    throw new AIRequestValidationError('AI request maxTokens must be greater than 0.');
  }
}

export function getAIRequestText(request: AIRequest): string {
  const parts = [
    request.systemPrompt,
    request.userPrompt,
    ...(request.messages ?? []).map((message) => `${message.role}: ${message.content}`)
  ];

  return parts.filter(Boolean).join('\n');
}
