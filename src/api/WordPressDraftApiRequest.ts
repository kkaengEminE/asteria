import { createPublishingPackage, createTag, type PublishingPackage } from '../domain/content/index.ts';

export interface WordPressDraftApiRequest {
  article: { title: string; body: string; summary: string; slug: string; language: string };
  seo: { metaTitle: string; metaDescription: string; keywords: string[] };
  faq: Array<{ question: string; answer: string }>;
  magazine: 'cat' | 'dog';
  featuredImageId?: number;
  clientRequestId: string;
}

export class WordPressDraftApiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordPressDraftApiRequestError';
  }
}

export function validateWordPressDraftApiRequest(value: unknown, clientRequestId?: string): WordPressDraftApiRequest {
  const input = requireObject(value, 'request');
  rejectUnknownKeys(input, ['article', 'seo', 'faq', 'magazine', 'featuredImageId']);
  const article = requireObject(input.article, 'article');
  const seo = requireObject(input.seo, 'seo');
  rejectUnknownKeys(article, ['title', 'body', 'summary', 'slug', 'language']);
  rejectUnknownKeys(seo, ['metaTitle', 'metaDescription', 'keywords']);
  const faq = Array.isArray(input.faq) ? input.faq : [];

  if (faq.length === 0) {
    throw new WordPressDraftApiRequestError('faq must contain at least one item.');
  }

  return {
    article: {
      title: requireString(article.title, 'article.title'),
      body: requireString(article.body, 'article.body'),
      summary: requireString(article.summary, 'article.summary'),
      slug: requireString(article.slug, 'article.slug'),
      language: requireString(article.language, 'article.language')
    },
    seo: {
      metaTitle: requireString(seo.metaTitle, 'seo.metaTitle'),
      metaDescription: requireString(seo.metaDescription, 'seo.metaDescription'),
      keywords: requireStringArray(seo.keywords, 'seo.keywords')
    },
    faq: faq.map((item, index) => {
      const faqItem = requireObject(item, `faq[${index}]`);
      rejectUnknownKeys(faqItem, ['question', 'answer']);
      return {
        question: requireString(faqItem.question, `faq[${index}].question`),
        answer: requireString(faqItem.answer, `faq[${index}].answer`)
      };
    }),
    magazine: requireMagazine(input.magazine),
    featuredImageId: requireOptionalPositiveInteger(input.featuredImageId, 'featuredImageId'),
    clientRequestId: requireString(clientRequestId, 'X-Client-Request-Id header')
  };
}

export function createWordPressDraftPublishingPackage(request: WordPressDraftApiRequest, now = new Date()): PublishingPackage {
  return createPublishingPackage({
    article: {
      ...request.article,
      createdAt: now.toISOString(),
      metadata: {
        status: 'draft',
        category: { name: request.magazine, slug: request.magazine },
        tags: request.seo.keywords.map(createTag)
      }
    },
    summary: { text: request.article.summary },
    seo: request.seo,
    faq: request.faq,
    imagePrompt: { prompt: `WordPress draft image for ${request.article.title}` },
    productPrompt: { prompt: `WordPress draft products for ${request.article.title}` },
    metadata: {
      magazine: request.magazine,
      clientRequestId: request.clientRequestId,
      wordpressFeaturedMediaId: request.featuredImageId
    }
  });
}

function requireObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WordPressDraftApiRequestError(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new WordPressDraftApiRequestError(`${name} is required.`);
  }
  return value.trim();
}

function requireStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new WordPressDraftApiRequestError(`${name} must be an array of strings.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function requireMagazine(value: unknown): 'cat' | 'dog' {
  if (value !== 'cat' && value !== 'dog') {
    throw new WordPressDraftApiRequestError('magazine must be one of: cat, dog.');
  }
  return value;
}

function requireOptionalPositiveInteger(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new WordPressDraftApiRequestError(`${name} must be a positive integer.`);
  }
  return value as number;
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: string[]): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) {
    throw new WordPressDraftApiRequestError(`Unsupported field: ${unknown}.`);
  }
}
