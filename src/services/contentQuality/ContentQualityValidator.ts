import type { PublishingPackage } from '../../domain/content/index.ts';

export interface ContentQualityRuleOptions {
  minimumArticleLength?: number;
  minimumSummaryLength?: number;
}

export interface ContentQualityReport {
  valid: boolean;
  score: number;
  errors: string[];
  warnings: string[];
}

export class ContentQualityValidator {
  private readonly minimumArticleLength: number;
  private readonly minimumSummaryLength: number;

  constructor(options: ContentQualityRuleOptions = {}) {
    this.minimumArticleLength = options.minimumArticleLength ?? 80;
    this.minimumSummaryLength = options.minimumSummaryLength ?? 20;
  }

  validate(pkg: PublishingPackage): ContentQualityReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    requireText(pkg.article?.title, 'Article title is empty.', errors);
    requireText(pkg.article?.body, 'Article body is empty.', errors);
    requireText(pkg.summary?.text, 'Summary text is empty.', errors);
    requireText(pkg.seo?.metaTitle, 'SEO metaTitle is empty.', errors);
    requireText(pkg.seo?.metaDescription, 'SEO metaDescription is empty.', errors);
    requireText(pkg.imagePrompt?.prompt, 'Image prompt is empty.', errors);
    requireText(pkg.productPrompt?.prompt, 'Product prompt is empty.', errors);

    if ((pkg.article?.body?.trim().length ?? 0) < this.minimumArticleLength) {
      warnings.push(`Article body is shorter than ${this.minimumArticleLength} characters.`);
    }

    if ((pkg.summary?.text?.trim().length ?? 0) < this.minimumSummaryLength) {
      warnings.push(`Summary is shorter than ${this.minimumSummaryLength} characters.`);
    }

    if (!pkg.seo?.keywords || pkg.seo.keywords.length === 0) {
      errors.push('SEO keywords are missing.');
    }

    if (!pkg.faq || pkg.faq.length === 0) {
      errors.push('FAQ items are missing.');
    }

    const duplicateFaqQuestions = findDuplicateFaqQuestions(pkg);

    if (duplicateFaqQuestions.length > 0) {
      warnings.push(`Duplicate FAQ questions found: ${duplicateFaqQuestions.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      score: calculateQualityScore(errors, warnings),
      errors,
      warnings
    };
  }
}

function requireText(value: string | undefined, message: string, errors: string[]): void {
  if (!value || value.trim().length === 0) {
    errors.push(message);
  }
}

function findDuplicateFaqQuestions(pkg: PublishingPackage): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of pkg.faq ?? []) {
    const normalized = item.question.trim().toLowerCase();

    if (seen.has(normalized)) {
      duplicates.add(item.question.trim());
    }

    seen.add(normalized);
  }

  return [...duplicates].sort();
}

function calculateQualityScore(errors: string[], warnings: string[]): number {
  return Math.max(0, Math.min(100, 100 - errors.length * 18 - warnings.length * 7));
}
