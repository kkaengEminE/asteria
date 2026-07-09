import { createProviderToken } from '../ProviderToken.ts';
import {
  createContentRequest,
  createPublishingPackage,
  type ContentRequest,
  type PublishingPackage
} from '../../domain/content/index.ts';
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
  publishingPackageResults?: Array<PublishingPackage | Error>;
}

export class MockAIProvider implements AIProvider {
  readonly name: string;
  private readonly model: string;
  private readonly publishingPackageResults: Array<PublishingPackage | Error>;

  constructor(options: MockAIProviderOptions = {}) {
    this.name = options.name ?? 'mock-ai';
    this.model = options.model ?? 'mock-model';
    this.publishingPackageResults = [...(options.publishingPackageResults ?? [])];
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

  async generatePublishingPackage(request: ContentRequest): Promise<PublishingPackage> {
    const result = this.publishingPackageResults.shift();

    if (result instanceof Error) {
      throw result;
    }

    if (result) {
      return result;
    }

    return createMockPublishingPackage(request, this.name, this.model);
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

export function createMockPublishingPackage(
  request: ContentRequest,
  provider = 'mock-ai',
  model = 'mock-model'
): PublishingPackage {
  const normalized = createContentRequest(request);
  const topic = normalized.topic;
  const language = normalized.language ?? 'ko-KR';
  const createdAt = normalized.createdAt ?? '2026-07-08T00:00:00.000Z';

  return createPublishingPackage({
    article: {
      title: `Mock Article: ${topic}`,
      subtitle: 'Dry-run content generation package',
      summary: `A deterministic dry-run article summary about ${topic}.`,
      body: [
        `This is a deterministic dry-run article about ${topic}.`,
        '',
        'It verifies that Asteria can request, assemble, and validate a complete publishing package without calling a real AI API.',
        '',
        'Publishing remains disabled.'
      ].join('\n'),
      slug: topic,
      language,
      author: 'Asteria Mock AI',
      createdAt,
      metadata: {
        status: 'draft',
        tags: []
      }
    },
    summary: {
      text: `A dry-run summary for ${topic}.`,
      bullets: [
        'Generated by MockAIProvider.',
        'Covers article, SEO, FAQ, image, and product prompt sections.',
        'No external API call was made.'
      ]
    },
    seo: {
      metaTitle: `${topic} | Asteria Dry Run`,
      metaDescription: `A dry-run SEO description for ${topic}.`,
      keywords: [topic, 'cat care', 'dry run']
    },
    faq: [
      {
        question: `${topic}에 대해 무엇을 먼저 알아야 하나요?`,
        answer: '이 항목은 드라이런용 FAQ이며 실제 의학적 조언이나 출판물이 아닙니다.'
      }
    ],
    imagePrompt: {
      prompt: `Create an editorial image search prompt for: ${topic}`,
      suggestedTags: ['cat', 'editorial', 'dry-run'],
      mood: 'warm and practical'
    },
    productPrompt: {
      prompt: `Find safe, relevant product recommendation ideas for: ${topic}`,
      suggestedCategories: ['cat care'],
      suggestedTags: ['cat', 'dry-run']
    },
    metadata: {
      dryRun: true,
      deterministic: true,
      provider,
      model,
      topic
    }
  });
}
