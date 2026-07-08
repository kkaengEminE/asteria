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
  stream(request: AIRequest): AsyncIterable<AIResponse>;
  countTokens(request: AIRequest): Promise<AIUsage>;
  healthCheck(): Promise<AIHealthCheckResult>;
}
