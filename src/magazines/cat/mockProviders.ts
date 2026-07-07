import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  Publisher,
  ResearchProvider
} from '../../core/index.ts';
import type { PublishingPayload, PublishingResult, ResearchQuery, ResearchResult } from '../../core/types.ts';

export function createMockResearchProvider(): ResearchProvider {
  return {
    name: 'mock-research',
    async search(query: ResearchQuery): Promise<ResearchResult[]> {
      return [
        {
          title: `Mock research brief for ${query.topic}`,
          source: 'Asteria Mock Research',
          summary: `Dry-run research summary for ${query.topic}. No external sources were called.`
        }
      ];
    }
  };
}

export function createMockAIProvider(): AIProvider {
  return {
    name: 'mock-ai',
    async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
      const isSeoPrompt = request.prompt.toLowerCase().includes('seo metadata');

      return {
        text: isSeoPrompt ? createMockSeo(request.prompt) : createMockArticle(request.prompt),
        model: 'mock-model'
      };
    }
  };
}

export function createMockPublisher(): Publisher {
  return {
    name: 'mock-publisher',
    async publish(payload: PublishingPayload): Promise<PublishingResult> {
      return {
        status: 'draft',
        destination: payload.destination,
        externalId: `dry-run-${payload.draft.slug ?? 'cat-article'}`,
        message: `Dry-run preview created for ${payload.draft.title}. Nothing was published.`
      };
    }
  };
}

function createMockArticle(prompt: string): string {
  return [
    'Title: Mock Cat Care Article',
    '',
    'Summary: A dry-run article draft generated from the rendered Cat Magazine prompt.',
    '',
    'Body:',
    'This mock article verifies that configuration, prompts, providers, and workflows are connected.',
    'It does not call an AI API and should only be used as a preview artifact.',
    '',
    `Prompt preview: ${prompt.slice(0, 120)}`
  ].join('\n');
}

function createMockSeo(prompt: string): string {
  return [
    'Title Tag: Mock Cat Care Guide',
    'Meta Description: A dry-run SEO preview for a Cat Magazine article.',
    'Slug: mock-cat-care-guide',
    `Prompt preview: ${prompt.slice(0, 80)}`
  ].join('\n');
}

