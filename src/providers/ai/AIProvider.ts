import type { ContentRequest, PublishingPackage } from '../../domain/content/index.ts';
import type { AIRequest } from './AIRequest.ts';
import type { AIResponse } from './AIResponse.ts';
import type { AIUsage } from './AIUsage.ts';

export interface AIHealthCheckResult {
  ok: boolean;
  provider: string;
  model?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface AIProvider {
  readonly name: string;
  generate(request: AIRequest): Promise<AIResponse>;
  generatePublishingPackage(request: ContentRequest): Promise<PublishingPackage>;
  stream(request: AIRequest): AsyncIterable<AIResponse>;
  countTokens(request: AIRequest): Promise<AIUsage>;
  healthCheck(): Promise<AIHealthCheckResult>;
}
