import type { PublishingPackage } from '../../domain/content/index.ts';
import type { EditorialReview } from '../../domain/editorialReview/index.ts';
import type { ContentQualityReport } from '../contentQuality/index.ts';

export type RealGenerationThresholdResult = 'PASS' | 'WARNING' | 'FAIL';
export type SeoRequiredField = 'metaTitle' | 'metaDescription' | 'keywords';

export interface RealGenerationReviewThresholds {
  minimumQualityScore?: number;
  minimumReviewScore?: number;
  minimumArticleWords?: number;
  requiredSeoFields?: SeoRequiredField[];
}

export interface RealGenerationReviewIssue {
  category: 'quality' | 'editorial' | 'seo' | 'article' | 'faq' | 'summary';
  severity: 'warning' | 'fail';
  message: string;
  recommendation: string;
}

export interface RealGenerationReview {
  thresholdResult: RealGenerationThresholdResult;
  articleTitle: string;
  articleWordCount: number;
  articleCharacterCount: number;
  seoTitle: string;
  seoDescription: string;
  faqCount: number;
  qualityScore: number;
  reviewScore: number;
  seoComplete: boolean;
  articleStructure: {
    paragraphCount: number;
    hasSubtitle: boolean;
    hasBody: boolean;
  };
  faqUseful: boolean;
  summaryUseful: boolean;
  issues: RealGenerationReviewIssue[];
  thresholds: Required<RealGenerationReviewThresholds>;
}

const defaultThresholds: Required<RealGenerationReviewThresholds> = {
  minimumQualityScore: 85,
  minimumReviewScore: 80,
  minimumArticleWords: 80,
  requiredSeoFields: ['metaTitle', 'metaDescription', 'keywords']
};

export class RealGenerationReviewService {
  private readonly thresholds: Required<RealGenerationReviewThresholds>;

  constructor(thresholds: RealGenerationReviewThresholds = {}) {
    this.thresholds = {
      ...defaultThresholds,
      ...thresholds,
      requiredSeoFields: thresholds.requiredSeoFields ?? defaultThresholds.requiredSeoFields
    };
  }

  review(
    publishingPackage: PublishingPackage,
    qualityReport: ContentQualityReport,
    editorialReview: EditorialReview
  ): RealGenerationReview {
    const articleWordCount = countWords(publishingPackage.article.body);
    const articleCharacterCount = publishingPackage.article.body.trim().length;
    const issues: RealGenerationReviewIssue[] = [];

    if (qualityReport.score < this.thresholds.minimumQualityScore) {
      issues.push(failIssue(
        'quality',
        `Quality score ${qualityReport.score} is below threshold ${this.thresholds.minimumQualityScore}.`,
        'Review structural completeness before considering this package ready.'
      ));
    }

    if (editorialReview.score < this.thresholds.minimumReviewScore) {
      issues.push(failIssue(
        'editorial',
        `Editorial review score ${editorialReview.score} is below threshold ${this.thresholds.minimumReviewScore}.`,
        'Resolve editorial review issues before publication readiness review.'
      ));
    }

    if (articleWordCount < this.thresholds.minimumArticleWords) {
      issues.push(failIssue(
        'article',
        `Article is ${articleWordCount} words, below threshold ${this.thresholds.minimumArticleWords}.`,
        'Expand the article with useful sections, examples, or practical detail.'
      ));
    }

    const missingSeoFields = getMissingSeoFields(publishingPackage, this.thresholds.requiredSeoFields);

    if (missingSeoFields.length > 0) {
      issues.push(failIssue(
        'seo',
        `Missing required SEO field(s): ${missingSeoFields.join(', ')}.`,
        'Complete SEO metadata before considering this package ready.'
      ));
    }

    const articleStructure = {
      paragraphCount: countParagraphs(publishingPackage.article.body),
      hasSubtitle: Boolean(publishingPackage.article.subtitle?.trim()),
      hasBody: publishingPackage.article.body.trim().length > 0
    };

    if (articleStructure.paragraphCount < 2) {
      issues.push(warningIssue(
        'article',
        'Article structure has fewer than 2 paragraphs.',
        'Add clearer paragraph structure for easier editorial review.'
      ));
    }

    const faqUseful = publishingPackage.faq.length > 0 && publishingPackage.faq.every((item) =>
      countWords(item.question) >= 3 && countWords(item.answer) >= 5
    );

    if (!faqUseful) {
      issues.push(warningIssue(
        'faq',
        'FAQ content may not be useful enough.',
        'Use specific reader questions with actionable answers.'
      ));
    }

    const summaryUseful = publishingPackage.summary.text.trim().length >= 40 ||
      (publishingPackage.summary.bullets?.length ?? 0) >= 2;

    if (!summaryUseful) {
      issues.push(warningIssue(
        'summary',
        'Summary may be too thin for review.',
        'Add a clearer summary or at least two useful summary bullets.'
      ));
    }

    return {
      thresholdResult: determineThresholdResult(issues),
      articleTitle: publishingPackage.article.title,
      articleWordCount,
      articleCharacterCount,
      seoTitle: publishingPackage.seo.metaTitle,
      seoDescription: publishingPackage.seo.metaDescription,
      faqCount: publishingPackage.faq.length,
      qualityScore: qualityReport.score,
      reviewScore: editorialReview.score,
      seoComplete: missingSeoFields.length === 0,
      articleStructure,
      faqUseful,
      summaryUseful,
      issues,
      thresholds: this.thresholds
    };
  }
}

function determineThresholdResult(issues: RealGenerationReviewIssue[]): RealGenerationThresholdResult {
  if (issues.some((issue) => issue.severity === 'fail')) {
    return 'FAIL';
  }

  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'WARNING';
  }

  return 'PASS';
}

function getMissingSeoFields(pkg: PublishingPackage, fields: SeoRequiredField[]): SeoRequiredField[] {
  return fields.filter((field) => {
    if (field === 'keywords') {
      return pkg.seo.keywords.length === 0;
    }

    return pkg.seo[field].trim().length === 0;
  });
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function countParagraphs(value: string): number {
  return value.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean).length;
}

function failIssue(
  category: RealGenerationReviewIssue['category'],
  message: string,
  recommendation: string
): RealGenerationReviewIssue {
  return {
    category,
    severity: 'fail',
    message,
    recommendation
  };
}

function warningIssue(
  category: RealGenerationReviewIssue['category'],
  message: string,
  recommendation: string
): RealGenerationReviewIssue {
  return {
    category,
    severity: 'warning',
    message,
    recommendation
  };
}

