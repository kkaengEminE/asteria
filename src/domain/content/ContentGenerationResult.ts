import type { Article } from './Article.ts';
import { validateArticle } from './Article.ts';
import type { FAQ } from './FAQ.ts';
import { createFAQ } from './FAQ.ts';
import type { SEO } from './SEO.ts';
import { createSEO } from './SEO.ts';

export interface ContentGenerationResult {
  article: Article;
  seo?: SEO;
  faq?: FAQ[];
  metadata?: Record<string, unknown>;
}

export class ContentGenerationResultValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentGenerationResultValidationError';
  }
}

export function createContentGenerationResult(result: ContentGenerationResult): ContentGenerationResult {
  validateContentGenerationResult(result);

  return {
    article: result.article,
    seo: result.seo ? createSEO(result.seo) : undefined,
    faq: result.faq?.map(createFAQ),
    metadata: normalizeContentMetadata(result.metadata)
  };
}

export function validateContentGenerationResult(result: ContentGenerationResult): void {
  if (!result.article) {
    throw new ContentGenerationResultValidationError('Content generation result requires article.');
  }

  validateArticle(result.article);

  if (result.seo) {
    createSEO(result.seo);
  }

  for (const faq of result.faq ?? []) {
    createFAQ(faq);
  }
}

export function normalizeContentMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => key.trim().length > 0 && value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

