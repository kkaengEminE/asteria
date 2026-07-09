import { createArticle, type Article } from './Article.ts';
import { createFAQ, type FAQ } from './FAQ.ts';
import { createImagePrompt, type ImagePrompt } from './ImagePrompt.ts';
import { normalizeContentMetadata } from './ContentGenerationResult.ts';
import { createProductPrompt, type ProductPrompt } from './ProductPrompt.ts';
import { createSEO, type SEO } from './SEO.ts';
import { createSummary, type Summary } from './Summary.ts';

export interface PublishingPackage {
  article: Article;
  summary: Summary;
  seo: SEO;
  faq: FAQ[];
  imagePrompt: ImagePrompt;
  productPrompt: ProductPrompt;
  metadata?: Record<string, unknown>;
}

export class PublishingPackageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishingPackageValidationError';
  }
}

export function createPublishingPackage(pkg: PublishingPackage): PublishingPackage {
  validatePublishingPackageShape(pkg);

  return {
    article: createArticle(pkg.article),
    summary: createSummary(pkg.summary),
    seo: createSEO(pkg.seo),
    faq: deduplicateFAQ(pkg.faq).map(createFAQ),
    imagePrompt: createImagePrompt(pkg.imagePrompt),
    productPrompt: createProductPrompt(pkg.productPrompt),
    metadata: normalizeContentMetadata(pkg.metadata)
  };
}

function deduplicateFAQ(items: FAQ[]): FAQ[] {
  const seen = new Set<string>();
  const result: FAQ[] = [];

  for (const item of items) {
    const question = item.question.trim().toLowerCase();

    if (seen.has(question)) {
      continue;
    }

    seen.add(question);
    result.push(item);
  }

  return result;
}

export function validatePublishingPackage(pkg: PublishingPackage): void {
  createPublishingPackage(pkg);
}

function validatePublishingPackageShape(pkg: PublishingPackage): void {
  if (!pkg.article) {
    throw new PublishingPackageValidationError('Publishing package requires article.');
  }

  if (!pkg.summary) {
    throw new PublishingPackageValidationError('Publishing package requires summary.');
  }

  if (!pkg.seo) {
    throw new PublishingPackageValidationError('Publishing package requires seo.');
  }

  if (!Array.isArray(pkg.faq) || pkg.faq.length === 0) {
    throw new PublishingPackageValidationError('Publishing package requires at least one faq item.');
  }

  if (!pkg.imagePrompt) {
    throw new PublishingPackageValidationError('Publishing package requires image prompt.');
  }

  if (!pkg.productPrompt) {
    throw new PublishingPackageValidationError('Publishing package requires product prompt.');
  }
}
