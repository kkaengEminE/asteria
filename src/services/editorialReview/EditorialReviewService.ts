import type { PublishingPackage } from '../../domain/content/index.ts';
import {
  createEditorialReview,
  determineReviewResult,
  type EditorialReview,
  type ReviewIssue
} from '../../domain/editorialReview/index.ts';

export interface EditorialReviewOptions {
  minimumArticleWords?: number;
  maximumTitleCharacters?: number;
  minimumSummaryCharacters?: number;
  maximumSummaryCharacters?: number;
}

export class EditorialReviewService {
  private readonly minimumArticleWords: number;
  private readonly maximumTitleCharacters: number;
  private readonly minimumSummaryCharacters: number;
  private readonly maximumSummaryCharacters: number;

  constructor(options: EditorialReviewOptions = {}) {
    this.minimumArticleWords = options.minimumArticleWords ?? 80;
    this.maximumTitleCharacters = options.maximumTitleCharacters ?? 70;
    this.minimumSummaryCharacters = options.minimumSummaryCharacters ?? 40;
    this.maximumSummaryCharacters = options.maximumSummaryCharacters ?? 180;
  }

  review(pkg: PublishingPackage): EditorialReview {
    const issues: ReviewIssue[] = [
      ...this.reviewCompleteness(pkg),
      ...this.reviewReadability(pkg),
      ...this.reviewSeo(pkg),
      ...this.reviewFaq(pkg),
      ...this.reviewMetadata(pkg),
      ...this.reviewTitle(pkg),
      ...this.reviewSummary(pkg)
    ];
    const score = calculateReviewScore(issues);
    const result = determineReviewResult(issues);

    return createEditorialReview({
      result,
      score,
      summary: createReviewSummary(result, score, issues),
      issues,
      reviewedAt: new Date().toISOString()
    });
  }

  private reviewCompleteness(pkg: PublishingPackage): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    if (!textPresent(pkg.article?.body)) {
      issues.push(failIssue('completeness', 'Article body is missing.', 'Regenerate or add the article body before review.'));
    }

    if (!textPresent(pkg.summary?.text)) {
      issues.push(failIssue('completeness', 'Summary is missing.', 'Generate a concise summary for the package.'));
    }

    if (!pkg.faq || pkg.faq.length === 0) {
      issues.push(failIssue('completeness', 'FAQ section is missing.', 'Add at least one reader-facing FAQ item.'));
    }

    return issues;
  }

  private reviewReadability(pkg: PublishingPackage): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const wordCount = countWords(pkg.article?.body ?? '');

    if (wordCount < this.minimumArticleWords) {
      issues.push(warningIssue(
        'readability',
        `Article body is short at ${wordCount} words.`,
        `Expand the article to at least ${this.minimumArticleWords} words before publication review.`
      ));
    }

    const longSentenceCount = splitSentences(pkg.article?.body ?? '')
      .filter((sentence) => countWords(sentence) > 35)
      .length;

    if (longSentenceCount > 0) {
      issues.push(warningIssue(
        'readability',
        `${longSentenceCount} sentence(s) may be too long.`,
        'Break long sentences into shorter, easier-to-scan guidance.'
      ));
    }

    return issues;
  }

  private reviewSeo(pkg: PublishingPackage): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    if (!textPresent(pkg.seo?.metaTitle)) {
      issues.push(failIssue('seo', 'SEO meta title is missing.', 'Add an SEO meta title before publication review.'));
    }

    if (!textPresent(pkg.seo?.metaDescription)) {
      issues.push(failIssue('seo', 'SEO meta description is missing.', 'Add an SEO meta description before publication review.'));
    }

    if (!pkg.seo?.keywords || pkg.seo.keywords.length === 0) {
      issues.push(warningIssue('seo', 'SEO keywords are missing.', 'Add focused search keywords for editorial review.'));
    }

    return issues;
  }

  private reviewFaq(pkg: PublishingPackage): ReviewIssue[] {
    const duplicateQuestions = findDuplicateFaqQuestions(pkg);

    return duplicateQuestions.map((question) =>
      warningIssue('faq', `Duplicate FAQ question found: ${question}`, 'Merge or rewrite duplicate FAQ entries.')
    );
  }

  private reviewMetadata(pkg: PublishingPackage): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    if (!textPresent(pkg.article?.slug)) {
      issues.push(failIssue('metadata', 'Article slug is missing.', 'Create a stable article slug before publication review.'));
    }

    if (!textPresent(pkg.article?.language)) {
      issues.push(failIssue('metadata', 'Article language is missing.', 'Set the article language in the content package.'));
    }

    if (!textPresent(pkg.article?.author)) {
      issues.push(warningIssue('metadata', 'Article author is missing.', 'Add an author or editorial byline before publication.'));
    }

    return issues;
  }

  private reviewTitle(pkg: PublishingPackage): ReviewIssue[] {
    const title = pkg.article?.title?.trim() ?? '';

    if (!title) {
      return [failIssue('title', 'Article title is missing.', 'Add a clear article title.')];
    }

    if (title.length > this.maximumTitleCharacters) {
      return [warningIssue(
        'title',
        `Article title is long at ${title.length} characters.`,
        `Keep the title near ${this.maximumTitleCharacters} characters for scanability.`
      )];
    }

    if (!/[a-zA-Z가-힣0-9]/.test(title)) {
      return [warningIssue('title', 'Article title has weak readable content.', 'Rewrite the title with clear reader-facing words.')];
    }

    return [];
  }

  private reviewSummary(pkg: PublishingPackage): ReviewIssue[] {
    const summary = pkg.summary?.text?.trim() ?? '';
    const issues: ReviewIssue[] = [];

    if (!summary) {
      issues.push(failIssue('summary', 'Summary text is missing.', 'Add a short summary before publication review.'));
      return issues;
    }

    if (summary.length < this.minimumSummaryCharacters) {
      issues.push(warningIssue(
        'summary',
        `Summary is short at ${summary.length} characters.`,
        `Expand the summary to at least ${this.minimumSummaryCharacters} characters.`
      ));
    }

    if (summary.length > this.maximumSummaryCharacters) {
      issues.push(warningIssue(
        'summary',
        `Summary is long at ${summary.length} characters.`,
        `Trim the summary to roughly ${this.maximumSummaryCharacters} characters.`
      ));
    }

    return issues;
  }
}

function calculateReviewScore(issues: ReviewIssue[]): number {
  const penalty = issues.reduce((total, issue) => {
    if (issue.severity === 'fail') {
      return total + 25;
    }

    if (issue.severity === 'warning') {
      return total + 8;
    }

    return total;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

function createReviewSummary(result: string, score: number, issues: ReviewIssue[]): string {
  if (issues.length === 0) {
    return `Editorial review ${result} with score ${score}. No issues found.`;
  }

  const failCount = issues.filter((issue) => issue.severity === 'fail').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  return `Editorial review ${result} with score ${score}. Issues: ${failCount} fail, ${warningCount} warning.`;
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

function textPresent(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(value: string): string[] {
  return value.split(/[.!?。！？]+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function failIssue(category: ReviewIssue['category'], message: string, recommendation: string): ReviewIssue {
  return {
    category,
    severity: 'fail',
    message,
    recommendation
  };
}

function warningIssue(category: ReviewIssue['category'], message: string, recommendation: string): ReviewIssue {
  return {
    category,
    severity: 'warning',
    message,
    recommendation
  };
}

