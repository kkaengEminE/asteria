export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number;
  currency?: string;
}

export function createAIUsage(promptTokens: number, completionTokens: number, options: Partial<AIUsage> = {}): AIUsage {
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost: options.estimatedCost,
    currency: options.currency
  };
}
