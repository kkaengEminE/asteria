import type { ArticleMetadata } from './ArticleMetadata.ts';
import { createArticleMetadata } from './ArticleMetadata.ts';
import type { ArticleSection } from './ArticleSection.ts';
import { validateArticleSection } from './ArticleSection.ts';
import { slugify } from './Tag.ts';

export interface Article {
  title: string;
  subtitle?: string;
  summary: string;
  body: string;
  slug: string;
  language: string;
  author?: string;
  createdAt: string;
  updatedAt?: string;
  sections?: ArticleSection[];
  metadata: ArticleMetadata;
}

export class ArticleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArticleValidationError';
  }
}

export function createArticle(article: Omit<Article, 'slug' | 'metadata'> & Partial<Pick<Article, 'slug' | 'metadata'>>): Article {
  const normalized: Article = {
    ...article,
    title: article.title.trim(),
    subtitle: article.subtitle?.trim(),
    summary: article.summary.trim(),
    body: article.body.trim(),
    slug: article.slug ? slugify(article.slug) : slugify(article.title),
    language: article.language.trim(),
    author: article.author?.trim(),
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    sections: article.sections,
    metadata: createArticleMetadata(article.metadata)
  };

  validateArticle(normalized);

  return normalized;
}

export function validateArticle(article: Article): void {
  if (!article.title || article.title.trim().length === 0) {
    throw new ArticleValidationError('Article requires title.');
  }

  if (!article.summary || article.summary.trim().length === 0) {
    throw new ArticleValidationError('Article requires summary.');
  }

  if (!article.body || article.body.trim().length === 0) {
    throw new ArticleValidationError('Article requires body.');
  }

  if (!article.slug || article.slug.trim().length === 0) {
    throw new ArticleValidationError('Article requires slug.');
  }

  if (!article.language || article.language.trim().length === 0) {
    throw new ArticleValidationError('Article requires language.');
  }

  if (!isValidDate(article.createdAt)) {
    throw new ArticleValidationError('Article createdAt must be a valid date string.');
  }

  if (article.updatedAt && !isValidDate(article.updatedAt)) {
    throw new ArticleValidationError('Article updatedAt must be a valid date string.');
  }

  for (const section of article.sections ?? []) {
    validateArticleSection(section);
  }
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

