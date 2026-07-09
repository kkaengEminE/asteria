import { runCatMagazineDryRun } from '../src/magazines/cat/index.ts';
import type { ReviewIssue } from '../src/domain/editorialReview/index.ts';

const args = parseDryRunArgs(process.argv.slice(2));
const result = await runCatMagazineDryRun({
  topic: args.topic,
  aiMode: args.aiMode
});

console.log(formatDryRunReport(result));

function formatDryRunReport(result: Awaited<ReturnType<typeof runCatMagazineDryRun>>): string {
  return [
    'Asteria Dry Run',
    '',
    `Magazine: ${result.magazine?.name ?? 'Unavailable'}`,
    `Topic: ${result.topic}`,
    `Workflow Status: ${result.workflowStatus}`,
    `Executed Steps: ${result.executedSteps.length > 0 ? result.executedSteps.join(' -> ') : 'None'}`,
    '',
    'Rendered Prompt Preview:',
    result.renderedPromptPreview ?? 'Unavailable',
    '',
    'Generated Mock Article:',
    result.articlePreview ?? 'Unavailable',
    '',
    'SEO Preview:',
    result.seoPreview ?? 'Unavailable',
    '',
    'Publishing Package:',
    result.publishingPackage
      ? [
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
        ].join('\n')
      : 'Unavailable',
    '',
    'Monetization Preview:',
    result.recommendedProducts && result.recommendedProducts.length > 0
      ? [
          ...result.recommendedProducts.map((product, index) =>
            [
              `${index + 1}. ${product.name}`,
              `Reason: ${product.reason}`,
              `Score: ${product.score}`,
              `Mock Link: ${result.affiliateLinks?.[index]?.url ?? 'Unavailable'}`
            ].join('\n')
          ),
          `Disclosure: ${result.affiliateDisclosure ?? 'Unavailable'}`
        ].join('\n\n')
      : result.monetizationPreview ?? 'Unavailable',
    '',
    'Selected Image:',
    result.selectedImage
      ? [
          `Filename: ${result.selectedImage.filename}`,
          `Tags: ${result.selectedImage.tags.join(', ')}`,
          `Category: ${result.selectedImage.category ?? 'Uncategorized'}`,
          `Score: ${result.imageSelectionReason?.score ?? 'Unavailable'}`,
          `Preview URI: ${result.imagePreview ?? 'Unavailable'}`
        ].join('\n')
      : 'Unavailable',
    '',
    'Publish Preview:',
    result.publishPreview
      ? `${result.publishPreview.status}: ${result.publishPreview.message ?? 'Dry-run preview generated.'}`
      : 'Unavailable',
    '',
    result.error ? `Error: ${result.error}` : 'No external APIs were called. Nothing was published.'
  ].join('\n');
}

function parseDryRunArgs(args: string[]): { topic?: string; aiMode: 'mock' | 'openai' } {
  const topicParts: string[] = [];
  let aiMode = process.env.ASTERIA_AI_MODE === 'openai' ? 'openai' : 'mock';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--ai') {
      aiMode = args[index + 1] === 'openai' ? 'openai' : 'mock';
      index += 1;
      continue;
    }

    if (arg.startsWith('--ai=')) {
      aiMode = arg.slice('--ai='.length) === 'openai' ? 'openai' : 'mock';
      continue;
    }

    topicParts.push(arg);
  }

  return {
    topic: topicParts.join(' ') || undefined,
    aiMode
  };
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
      if (!issue || typeof issue !== 'object') {
        return 'Unknown review issue';
      }

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

function formatRealGenerationReview(
  review: Awaited<ReturnType<typeof runCatMagazineDryRun>>['contentGenerationMetadata'] extends infer Metadata
    ? Metadata extends { realGenerationReview?: infer Review }
      ? Review
      : never
    : never
): string {
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

function formatApprovalReport(
  approval: Awaited<ReturnType<typeof runCatMagazineDryRun>>['contentGenerationMetadata'] extends infer Metadata
    ? Metadata extends { approvalResult?: infer Approval }
      ? Approval
      : never
    : never
): string {
  if (!approval || typeof approval !== 'object') {
    return 'Unavailable';
  }

  const value = approval as {
    decision?: string;
    reasons?: Array<{ category?: string; message?: string; blocking?: boolean; recommendation?: string }>;
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
