import { createProviderToken } from '../ProviderToken.ts';
import type { AIProvider, AIHealthCheckResult } from './AIProvider.ts';
import { getAIRequestText, validateAIRequest, type AIRequest } from './AIRequest.ts';
import type { AIResponse } from './AIResponse.ts';
import { createAIUsage, type AIUsage } from './AIUsage.ts';

export const mockAIProviderToken = createProviderToken<AIProvider>(
  'AI',
  'mock-ai',
  'Deterministic mock AI provider for dry runs and tests.'
);

export interface MockAIProviderOptions {
  name?: string;
  model?: string;
}

export class MockAIProvider implements AIProvider {
  readonly name: string;
  private readonly model: string;

  constructor(options: MockAIProviderOptions = {}) {
    this.name = options.name ?? 'mock-ai';
    this.model = options.model ?? 'mock-model';
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    validateAIRequest(request);

    const content = createDeterministicContent(request);
    const usage = createAIUsage(countApproximateTokens(getAIRequestText(request)), countApproximateTokens(content), {
      estimatedCost: 0,
      currency: 'USD'
    });

    return {
      content,
      finishReason: 'stop',
      usage,
      model: request.model ?? this.model,
      provider: this.name,
      metadata: {
        dryRun: true,
        deterministic: true
      }
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIResponse> {
    yield await this.generate(request);
  }

  async countTokens(request: AIRequest): Promise<AIUsage> {
    validateAIRequest(request);
    return createAIUsage(countApproximateTokens(getAIRequestText(request)), 0, {
      estimatedCost: 0,
      currency: 'USD'
    });
  }

  async healthCheck(): Promise<AIHealthCheckResult> {
    return {
      ok: true,
      provider: this.name,
      model: this.model,
      message: 'Mock AI provider is available.',
      metadata: {
        dryRun: true
      }
    };
  }
}

export function createDeterministicContent(request: AIRequest): string {
  const prompt = getPrimaryPrompt(request);
  const isSeoPrompt = prompt.toLowerCase().includes('seo metadata');

  return isSeoPrompt ? createMockSeo(prompt) : createMockArticle(prompt);
}

export function countApproximateTokens(text: string): number {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).length;
}

function getPrimaryPrompt(request: AIRequest): string {
  if (request.userPrompt) {
    return request.userPrompt;
  }

  const userMessage = request.messages?.find((message) => message.role === 'user');

  if (userMessage) {
    return userMessage.content;
  }

  return getAIRequestText(request);
}

function createMockArticle(prompt: string): string {
  return [
    'Title: Mock Cat Care Article',
    '',
    'Summary: A dry-run article draft generated from the rendered prompt.',
    '',
    'Body:',
    'This mock article verifies that prompts, providers, and workflows are connected.',
    'It does not call an AI API and should only be used as a preview artifact.',
    '',
    `Prompt preview: ${prompt.slice(0, 120)}`
  ].join('\n');
}

function createMockSeo(prompt: string): string {
  return [
    'Title Tag: Mock Cat Care Guide',
    'Meta Description: A dry-run SEO preview generated from the rendered prompt.',
    'Slug: mock-cat-care-guide',
    `Prompt preview: ${prompt.slice(0, 80)}`
  ].join('\n');
}
