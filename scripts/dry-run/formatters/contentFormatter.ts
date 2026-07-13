import type { ReviewIssue } from '../../../src/domain/editorialReview/index.ts';
import type { DryRunResult } from '../../../src/services/dryRun/index.ts';

export function formatGeneratedArticle(result: DryRunResult): string {
  if (result.publishingPackage) {
    return [
      `Title: ${result.publishingPackage.article.title}`,
      result.publishingPackage.article.subtitle ? `Subtitle: ${result.publishingPackage.article.subtitle}` : undefined,
      '',
      `Summary: ${result.publishingPackage.article.summary}`,
      '',
      'Body:',
      result.publishingPackage.article.body
    ].filter((line): line is string => line !== undefined).join('\n');
  }

  return result.articlePreview ?? 'Unavailable';
}

export function formatSeoPreview(result: DryRunResult): string {
  if (result.publishingPackage) {
    return [
      `Title Tag: ${result.publishingPackage.seo.metaTitle}`,
      `Meta Description: ${result.publishingPackage.seo.metaDescription}`,
      `Keywords: ${result.publishingPackage.seo.keywords.join(', ') || 'Unavailable'}`,
      result.publishingPackage.seo.canonical ? `Canonical: ${result.publishingPackage.seo.canonical}` : undefined
    ].filter((line): line is string => line !== undefined).join('\n');
  }

  return result.seoPreview ?? 'Unavailable';
}

export function formatPublishingPackage(result: DryRunResult): string {
  if (!result.publishingPackage) {
    return 'Unavailable';
  }

  return [
    `Provider: ${result.contentGenerationMetadata?.providerName ?? 'Unavailable'}`,
    `Model: ${result.contentGenerationMetadata?.modelName ?? 'Unavailable'}`,
    `Prompt Profile: ${result.contentGenerationMetadata?.promptProfile ?? 'Unavailable'}`,
    `Prompt ID: ${result.contentGenerationMetadata?.promptId ?? 'Unavailable'}`,
    `Prompt Stack: ${result.contentGenerationMetadata?.promptIds?.join(' -> ') ?? 'Unavailable'}`,
    `Prompt Version: ${result.contentGenerationMetadata?.promptVersion ?? 'Unavailable'}`,
    `Rendered Variables: ${formatRenderedVariables(result.contentGenerationMetadata?.renderedVariables)}`,
    `Composed Prompt Preview: ${result.contentGenerationMetadata?.composedPromptPreview ?? 'Unavailable'}`,
    `Retry Count: ${result.contentGenerationMetadata?.retryCount ?? 'Unavailable'}`,
    `Validation Result: ${result.contentGenerationMetadata?.validationResult ?? 'Unavailable'}`,
    `Validation Report: ${formatValidationReport(result.contentGenerationMetadata?.validationErrors)}`,
    `Quality Score: ${result.contentGenerationMetadata?.qualityScore ?? 'Unavailable'}`,
    `Quality Report: ${formatQualityReport(result.contentGenerationMetadata?.qualityReport)}`,
    `Review Score: ${result.contentGenerationMetadata?.reviewScore ?? 'Unavailable'}`,
    `Review Result: ${result.contentGenerationMetadata?.reviewResult ?? 'Unavailable'}`,
    `Review Summary: ${result.contentGenerationMetadata?.reviewSummary ?? 'Unavailable'}`,
    `Review Issues: ${formatReviewIssues(result.contentGenerationMetadata?.reviewIssues)}`,
    `Threshold Result: ${result.contentGenerationMetadata?.realGenerationThresholdResult ?? 'Unavailable'}`,
    `Real Review: ${formatRealGenerationReview(result.contentGenerationMetadata?.realGenerationReview)}`,
    `Approval Decision: ${result.contentGenerationMetadata?.approvalDecision ?? 'Unavailable'}`,
    `Approval Report: ${formatApprovalReport(result.contentGenerationMetadata?.approvalResult)}`,
    `Generation Duration: ${result.contentGenerationMetadata?.generationDurationMs ?? 'Unavailable'}ms`,
    `Token Usage: ${formatTokenUsage(result.contentGenerationMetadata?.tokenUsage)}`,
    `Article: ${result.publishingPackage.article.title}`,
    `Summary: ${result.publishingPackage.summary.text}`,
    `SEO Title: ${result.publishingPackage.seo.metaTitle}`,
    `FAQ: ${result.publishingPackage.faq[0]?.question ?? 'Unavailable'}`,
    `Image Search Prompt: ${result.publishingPackage.imagePrompt.prompt}`,
    `Product Recommendation Prompt: ${result.publishingPackage.productPrompt.prompt}`
  ].join('\n');
}

function formatTokenUsage(usage: unknown): string {
  if (!usage || typeof usage !== 'object') {
    return 'Unavailable';
  }

  const value = usage as {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  return `prompt=${value.promptTokens ?? 0}, completion=${value.completionTokens ?? 0}, total=${value.totalTokens ?? 0}`;
}

function formatValidationReport(errors: string[] | undefined): string {
  return errors && errors.length > 0 ? errors.join('; ') : 'No validation errors';
}

function formatQualityReport(report: unknown): string {
  if (!report || typeof report !== 'object') {
    return 'Unavailable';
  }

  const qualityReport = report as {
    valid?: boolean;
    errors?: string[];
    warnings?: string[];
  };

  return [
    `valid=${qualityReport.valid === true}`,
    `errors=${qualityReport.errors?.length ?? 0}`,
    `warnings=${qualityReport.warnings?.length ?? 0}`
  ].join(', ');
}

function formatReviewIssues(issues: ReviewIssue[] | undefined): string {
  if (!Array.isArray(issues) || issues.length === 0) {
    return 'No review issues';
  }

  return issues
    .map((issue) => {
      const value = issue as {
        category?: string;
        severity?: string;
        message?: string;
        recommendation?: string;
      };

      return `[${value.severity ?? 'unknown'}:${value.category ?? 'unknown'}] ${value.message ?? 'No message'} Recommendation: ${value.recommendation ?? 'None'}`;
    })
    .join('; ');
}

function formatRealGenerationReview(review: unknown): string {
  if (!review || typeof review !== 'object') {
    return 'Unavailable';
  }

  const value = review as {
    articleTitle?: string;
    articleWordCount?: number;
    articleCharacterCount?: number;
    seoTitle?: string;
    seoDescription?: string;
    faqCount?: number;
    qualityScore?: number;
    reviewScore?: number;
    thresholdResult?: string;
    issues?: Array<{ severity?: string; category?: string; message?: string }>;
  };
  const issues = value.issues && value.issues.length > 0
    ? value.issues.map((issue) => `[${issue.severity ?? 'unknown'}:${issue.category ?? 'unknown'}] ${issue.message ?? 'No message'}`).join('; ')
    : 'No threshold issues';

  return [
    `Article Title: ${value.articleTitle ?? 'Unavailable'}`,
    `Article Words: ${value.articleWordCount ?? 'Unavailable'}`,
    `Article Characters: ${value.articleCharacterCount ?? 'Unavailable'}`,
    `SEO Title: ${value.seoTitle ?? 'Unavailable'}`,
    `SEO Description: ${value.seoDescription ?? 'Unavailable'}`,
    `FAQ Count: ${value.faqCount ?? 'Unavailable'}`,
    `Quality Score: ${value.qualityScore ?? 'Unavailable'}`,
    `Review Score: ${value.reviewScore ?? 'Unavailable'}`,
    `Threshold Result: ${value.thresholdResult ?? 'Unavailable'}`,
    `Threshold Issues: ${issues}`
  ].join(' | ');
}

function formatApprovalReport(approval: unknown): string {
  if (!approval || typeof approval !== 'object') {
    return 'Unavailable';
  }

  const value = approval as {
    decision?: string;
    reasons?: Array<{ category?: string; message?: string; blocking?: boolean }>;
    recommendations?: string[];
    blockingIssues?: Array<{ category?: string; message?: string }>;
    nonBlockingIssues?: Array<{ category?: string; message?: string }>;
  };
  const reasons = value.reasons && value.reasons.length > 0
    ? value.reasons.map((reason) => `[${reason.blocking ? 'blocking' : 'review'}:${reason.category ?? 'unknown'}] ${reason.message ?? 'No message'}`).join('; ')
    : 'No approval reasons';
  const blocking = value.blockingIssues && value.blockingIssues.length > 0
    ? value.blockingIssues.map((issue) => `[${issue.category ?? 'unknown'}] ${issue.message ?? 'No message'}`).join('; ')
    : 'No blocking issues';
  const recommendations = value.recommendations && value.recommendations.length > 0
    ? value.recommendations.join('; ')
    : 'No recommendations';

  return [
    `Decision: ${value.decision ?? 'Unavailable'}`,
    `Reasons: ${reasons}`,
    `Blocking Issues: ${blocking}`,
    `Recommendations: ${recommendations}`,
    `Non-blocking Issues: ${value.nonBlockingIssues?.length ?? 0}`
  ].join(' | ');
}

function formatRenderedVariables(variables: Record<string, unknown> | undefined): string {
  if (!variables) {
    return 'Unavailable';
  }

  return Object.entries(variables)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');
}
