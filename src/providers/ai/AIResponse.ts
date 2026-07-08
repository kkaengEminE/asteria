import type { AIUsage } from './AIUsage.ts';

export type AIFinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';

export interface AIResponse {
  content: string;
  finishReason: AIFinishReason;
  usage: AIUsage;
  model: string;
  provider: string;
  metadata?: Record<string, unknown>;
}
