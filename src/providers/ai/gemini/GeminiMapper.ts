import {
  createPublishingPackage,
  type ContentRequest,
  type PublishingPackage
} from '../../../domain/content/index.ts';
import type { AIRequest } from '../AIRequest.ts';
import type { AIResponse } from '../AIResponse.ts';
import { createAIUsage } from '../AIUsage.ts';
import { repairCommonJsonText, truncateForPreview } from '../../../utils/jsonRepair.ts';
import type { GeminiConfig } from './GeminiConfig.ts';

export interface GeminiGenerateContentRequestBody {
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
}

export interface GeminiGenerateContentBody {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
  error?: {
    message?: string;
    status?: string;
    code?: number;
  };
}

export function mapAIRequestToGeminiRequest(request: AIRequest): GeminiGenerateContentRequestBody {
  const contents: GeminiGenerateContentRequestBody['contents'] = [];

  for (const message of request.messages ?? []) {
    contents.push({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    });
  }

  if (request.userPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: request.userPrompt }]
    });
  }

  return {
    systemInstruction: request.systemPrompt
      ? {
          parts: [{ text: request.systemPrompt }]
        }
      : undefined,
    contents,
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      responseMimeType: request.metadata?.contentType === 'publishing-package' ? 'application/json' : undefined
    }
  };
}

export function mapGeminiResponseToAIResponse(body: GeminiGenerateContentBody, config: GeminiConfig): AIResponse {
  const usage = body.usageMetadata;

  return {
    content: extractGeminiOutputText(body),
    finishReason: mapGeminiFinishReason(body.candidates?.[0]?.finishReason),
    usage: createAIUsage(usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0),
    model: body.modelVersion ?? config.model,
    provider: 'gemini',
    metadata: {
      totalTokenCount: usage?.totalTokenCount,
      finishReason: body.candidates?.[0]?.finishReason
    }
  };
}

export function createGeminiPublishingPackageRequest(request: ContentRequest, config: GeminiConfig): AIRequest {
  const renderedPrompt =
    typeof request.metadata?.renderedPrompt === 'string' && request.metadata.renderedPrompt.trim().length > 0
      ? request.metadata.renderedPrompt
      : createFallbackPublishingPackagePrompt(request);

  return {
    systemPrompt: [
      'You are Asteria, a provider-agnostic content generation engine.',
      'Return only one strict valid JSON object for a complete publishing package.',
      'Do not include markdown fences, comments, commentary, or explanatory text.',
      'Escape every newline inside JSON strings as \\n.',
      'Escape every quotation mark inside JSON strings as \\".',
      'Return complete JSON only, with no text before or after the object.'
    ].join(' '),
    userPrompt: [
      renderedPrompt,
      '',
      'Strict JSON output rules:',
      '- Return exactly one JSON object.',
      '- Do not wrap the JSON in ```json fences.',
      '- Do not add commentary before or after the JSON.',
      '- Escape all newlines inside string values as \\n.',
      '- Escape all quotes inside string values as \\".',
      '- Keep long article body text inside the article.body JSON string.',
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

export function mapGeminiContentToPublishingPackage(content: string, request: ContentRequest): PublishingPackage {
  const parsed = parseJsonObject(content);
  const normalized = normalizeGeminiPublishingPackage(parsed, request);

  return createPublishingPackage({
    ...normalized,
    metadata: {
      ...normalized.metadata,
      provider: 'gemini',
      topic: request.topic,
      source: 'ai-response'
    }
  });
}

export class GeminiOutputParseError extends Error {
  readonly parseError: string;
  readonly rawResponsePreview: string;

  constructor(parseError: string, rawResponse: string) {
    super([
      'Gemini publishing package response was not valid JSON.',
      `Parse error: ${parseError}`,
      `Raw response preview: ${truncateForPreview(rawResponse)}`
    ].join(' '));
    this.name = 'GeminiOutputParseError';
    this.parseError = parseError;
    this.rawResponsePreview = truncateForPreview(rawResponse);
  }
}

export function extractGeminiErrorMessage(body: unknown): string {
  if (isGeminiGenerateContentBody(body) && body.error?.message) {
    return body.error.message;
  }

  return 'Gemini request failed.';
}

export function isGeminiGenerateContentBody(body: unknown): body is GeminiGenerateContentBody {
  return typeof body === 'object' && body !== null;
}

function extractGeminiOutputText(body: GeminiGenerateContentBody): string {
  return (
    body.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text)
      .filter((text): text is string => Boolean(text))
      .join('\n') ?? ''
  );
}

function mapGeminiFinishReason(reason: string | undefined): AIResponse['finishReason'] {
  if (reason === 'MAX_TOKENS') {
    return 'length';
  }

  if (reason === 'SAFETY' || reason === 'RECITATION' || reason === 'OTHER') {
    return 'content_filter';
  }

  return 'stop';
}

function parseJsonObject(content: string): Record<string, unknown> {
  const jsonText = extractJsonObjectText(content);

  try {
    return asRecord(JSON.parse(jsonText));
  } catch (error) {
    const repair = repairCommonJsonText(jsonText);

    if (repair.repaired) {
      try {
        return asRecord(JSON.parse(repair.text));
      } catch {
        // Surface the original parser error because it is closest to the provider output.
      }
    }

    throw new GeminiOutputParseError(error instanceof Error ? error.message : String(error), jsonText);
  }
}

function normalizeGeminiPublishingPackage(parsed: Record<string, unknown>, request: ContentRequest): PublishingPackage {
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
