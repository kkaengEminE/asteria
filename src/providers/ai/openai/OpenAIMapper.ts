import {
  createPublishingPackage,
  type ContentRequest,
  type PublishingPackage
} from '../../../domain/content/index.ts';
import type { AIMessage } from '../AIMessage.ts';
import type { AIRequest } from '../AIRequest.ts';
import type { AIResponse } from '../AIResponse.ts';
import { createAIUsage } from '../AIUsage.ts';
import type { OpenAIConfig } from './OpenAIConfig.ts';

export interface OpenAIResponsesRequestBody {
  model: string;
  input: Array<{
    role: string;
    content: string;
  }>;
  temperature?: number;
  max_output_tokens?: number;
  metadata?: Record<string, string>;
}

export interface OpenAIResponsesBody {
  id?: string;
  model?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  status?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export function mapAIRequestToOpenAIRequest(request: AIRequest, config: OpenAIConfig): OpenAIResponsesRequestBody {
  return {
    model: request.model ?? config.model,
    input: createInputMessages(request),
    temperature: request.temperature,
    max_output_tokens: request.maxTokens,
    metadata: stringifyMetadata(request.metadata)
  };
}

export function mapOpenAIResponseToAIResponse(body: OpenAIResponsesBody, config: OpenAIConfig): AIResponse {
  const content = extractOutputText(body);
  const promptTokens = body.usage?.input_tokens ?? 0;
  const completionTokens = body.usage?.output_tokens ?? 0;

  return {
    content,
    finishReason: body.status === 'incomplete' ? 'length' : 'stop',
    usage: createAIUsage(promptTokens, completionTokens),
    model: body.model ?? config.model,
    provider: 'openai',
    metadata: {
      openAIResponseId: body.id,
      status: body.status
    }
  };
}

export function createOpenAIPublishingPackageRequest(request: ContentRequest, config: OpenAIConfig): AIRequest {
  const renderedPrompt =
    typeof request.metadata?.renderedPrompt === 'string' && request.metadata.renderedPrompt.trim().length > 0
      ? request.metadata.renderedPrompt
      : createFallbackPublishingPackagePrompt(request);

  return {
    systemPrompt: [
      'You are Asteria, a provider-agnostic content generation engine.',
      'Return only valid JSON for a complete publishing package.',
      'Do not include markdown fences or explanatory text.'
    ].join(' '),
    userPrompt: [
      renderedPrompt,
      '',
      'JSON shape:',
      '{',
      '  "article": {"title": "...", "subtitle": "...", "summary": "...", "body": "...", "slug": "...", "language": "...", "author": "...", "createdAt": "ISO date string"},',
      '  "summary": {"text": "...", "bullets": ["..."]},',
      '  "seo": {"metaTitle": "...", "metaDescription": "...", "keywords": ["..."]},',
      '  "faq": [{"question": "...", "answer": "..."}],',
      '  "imagePrompt": {"prompt": "...", "suggestedTags": ["..."], "mood": "..."},',
      '  "productPrompt": {"prompt": "...", "suggestedCategories": ["..."], "suggestedTags": ["..."]}',
      '}'
    ].join('\n'),
    model: config.model,
    temperature: 0.4,
    maxTokens: 4000,
    metadata: {
      contentType: 'publishing-package',
      topic: request.topic,
      promptId: request.metadata?.promptId,
      promptVersion: request.metadata?.promptVersion
    }
  };
}

export function mapOpenAIContentToPublishingPackage(content: string, request: ContentRequest): PublishingPackage {
  const parsed = parseJsonObject(content);
  const normalized = normalizeOpenAIPublishingPackage(parsed, request);

  return createPublishingPackage({
    ...normalized,
    metadata: {
      ...normalized.metadata,
      provider: 'openai',
      topic: request.topic,
      source: 'ai-response'
    }
  });
}

export function extractOpenAIErrorMessage(body: unknown): string {
  if (isOpenAIResponsesBody(body) && body.error?.message) {
    return body.error.message;
  }

  return 'OpenAI request failed.';
}

export function isOpenAIResponsesBody(body: unknown): body is OpenAIResponsesBody {
  return typeof body === 'object' && body !== null;
}

function createInputMessages(request: AIRequest): AIMessage[] {
  const messages: AIMessage[] = [];

  if (request.systemPrompt) {
    messages.push({
      role: 'system',
      content: request.systemPrompt
    });
  }

  if (request.messages) {
    messages.push(...request.messages);
  }

  if (request.userPrompt) {
    messages.push({
      role: 'user',
      content: request.userPrompt
    });
  }

  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

function extractOutputText(body: OpenAIResponsesBody): string {
  if (body.output_text) {
    return body.output_text;
  }

  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text))
      .join('\n') ?? ''
  );
}

function stringifyMetadata(metadata: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!metadata) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => key.trim().length > 0 && value !== undefined)
      .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])
  );
}

function parseJsonObject(content: string): Record<string, unknown> {
  const jsonText = extractJsonObjectText(content);

  try {
    return asRecord(JSON.parse(jsonText));
  } catch (error) {
    throw new Error(`OpenAI publishing package response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeOpenAIPublishingPackage(parsed: Record<string, unknown>, request: ContentRequest): PublishingPackage {
  const articleValue = parsed.article;
  const article = asRecord(articleValue);
  const summary = normalizeSummary(parsed.summary, article);
  const seo = normalizeSeo(parsed.seo);

  return {
    article: {
      title: firstString(article.title, parsed.title),
      subtitle: firstString(article.subtitle, parsed.subtitle),
      summary: firstString(article.summary, summary.text),
      body: firstString(article.body, article.content, articleValue, parsed.articleBody, parsed.body),
      slug: firstString(article.slug, parsed.slug),
      language: firstString(article.language, parsed.language, request.language) || 'ko-KR',
      author: firstString(article.author, parsed.author, request.magazineName) || 'Asteria',
      createdAt: firstString(article.createdAt, article.created_at, parsed.createdAt, request.createdAt) || '2026-07-08T00:00:00.000Z',
      updatedAt: firstString(article.updatedAt, article.updated_at),
      metadata: {
        status: 'draft',
        tags: [],
        metadata: asRecord(article.metadata)
      }
    },
    summary,
    seo,
    faq: normalizeFaq(parsed.faq ?? parsed.faqs),
    imagePrompt: normalizeImagePrompt(parsed.imagePrompt ?? parsed.image_prompt ?? parsed.imageSearchPrompt ?? parsed.image_search_prompt),
    productPrompt: normalizeProductPrompt(
      parsed.productPrompt ??
        parsed.product_prompt ??
        parsed.productRecommendationPrompt ??
        parsed.product_recommendation_prompt
    ),
    metadata: asRecord(parsed.metadata)
  };
}

function normalizeSummary(value: unknown, article: Record<string, unknown>): PublishingPackage['summary'] {
  if (typeof value === 'string') {
    return {
      text: value
    };
  }

  const record = asRecord(value);

  return {
    text: firstString(record.text, record.summary, article.summary),
    bullets: normalizeStringArray(record.bullets ?? record.key_points ?? record.keyPoints)
  };
}

function normalizeSeo(value: unknown): PublishingPackage['seo'] {
  const record = asRecord(value);

  return {
    metaTitle: firstString(record.metaTitle, record.meta_title, record.title),
    metaDescription: firstString(record.metaDescription, record.meta_description, record.description),
    keywords: normalizeStringArray(record.keywords) ?? [],
    canonical: firstString(record.canonical),
    openGraph: asOptionalRecord(record.openGraph ?? record.open_graph) as PublishingPackage['seo']['openGraph'],
    twitterCard: asOptionalRecord(record.twitterCard ?? record.twitter_card) as PublishingPackage['seo']['twitterCard']
  };
}

function normalizeFaq(value: unknown): PublishingPackage['faq'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (typeof item === 'string') {
      return {
        question: item,
        answer: item
      };
    }

    const record = asRecord(item);

    return {
      question: firstString(record.question, record.q),
      answer: firstString(record.answer, record.a)
    };
  }) as PublishingPackage['faq'];
}

function normalizeImagePrompt(value: unknown): PublishingPackage['imagePrompt'] {
  if (typeof value === 'string') {
    return {
      prompt: value
    };
  }

  const record = asRecord(value);

  return {
    prompt: firstString(record.prompt, record.query, record.text),
    suggestedTags: normalizeStringArray(record.suggestedTags ?? record.suggested_tags ?? record.tags),
    mood: firstString(record.mood)
  };
}

function normalizeProductPrompt(value: unknown): PublishingPackage['productPrompt'] {
  if (typeof value === 'string') {
    return {
      prompt: value
    };
  }

  const record = asRecord(value);

  return {
    prompt: firstString(record.prompt, record.query, record.text),
    suggestedCategories: normalizeStringArray(record.suggestedCategories ?? record.suggested_categories ?? record.categories),
    suggestedTags: normalizeStringArray(record.suggestedTags ?? record.suggested_tags ?? record.tags)
  };
}

function extractJsonObjectText(content: string): string {
  const trimmed = stripMarkdownFence(content.trim());
  const start = trimmed.indexOf('{');

  if (start < 0) {
    return trimmed;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return trimmed.slice(start, index + 1);
      }
    }
  }

  return trimmed.slice(start);
}

function stripMarkdownFence(value: string): string {
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return undefined;
}

function createFallbackPublishingPackagePrompt(request: ContentRequest): string {
  return [
    'Generate a complete PublishingPackage for this topic.',
    '',
    `Topic: ${request.topic}`,
    `Language: ${request.language ?? 'ko-KR'}`,
    `Magazine: ${request.magazineName ?? 'Asteria Magazine'}`,
    `Audience: ${request.audience ?? 'general readers'}`,
    `Tone: ${request.tone ?? 'clear, useful, and trustworthy'}`
  ].join('\n');
}
