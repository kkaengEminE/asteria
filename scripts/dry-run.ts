import { pathToFileURL } from 'node:url';
import { loadEnvFile } from '../src/config/index.ts';
import { runMagazineDryRun } from '../src/magazines/runtime/index.ts';
import type { ReviewIssue } from '../src/domain/editorialReview/index.ts';

if (isMainModule()) {
  await runDryRunCli(process.argv.slice(2));
}

export async function runDryRunCli(argv: string[]): Promise<void> {
  loadEnvFile();
  const args = parseDryRunArgs(argv);
  const result = await runMagazineDryRun({
    topic: args.topic,
    magazineSlug: args.magazine,
    aiMode: args.aiMode,
    language: args.language
  });

  console.log(formatDryRunReport(result));
}

export function formatDryRunReport(result: Awaited<ReturnType<typeof runMagazineDryRun>>): string {
  const providerName = result.contentGenerationMetadata?.providerName;
  const generatedArticle = formatGeneratedArticle(result);
  const seoPreview = formatSeoPreview(result);

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
    `${providerName === 'mock-ai' || !providerName ? 'Generated Mock Article' : 'Generated Article'}:`,
    generatedArticle,
    '',
    'SEO Preview:',
    seoPreview,
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
    'Publishing Queue:',
    result.queueResult
      ? [
          `Result: ${result.queueResult.status}`,
          `Queue Item ID: ${result.queueResult.item?.id ?? 'Unavailable'}`,
          `Queue Status: ${result.queueResult.item?.status ?? 'Unavailable'}`,
          `Approval Decision: ${result.queueResult.approvalDecision}`,
          `Destination: ${result.queueResult.item?.destination.name ?? result.publishPreview?.destination.name ?? 'Unavailable'}`,
          `Reason: ${result.queueResult.failure?.reason ?? result.queueResult.message}`
        ].join('\n')
      : 'Unavailable',
    '',
    'Scheduler:',
    result.schedulerResult
      ? [
          `Result: ${result.schedulerResult.status}`,
          `Job ID: ${result.schedulerResult.job?.id ?? 'Unavailable'}`,
          `Job Status: ${result.schedulerResult.job?.status ?? 'Unavailable'}`,
          `Queue Item ID: ${result.schedulerResult.job?.queueItemId ?? result.queueResult?.item?.id ?? 'Unavailable'}`,
          `Scheduled For: ${result.schedulerResult.job?.scheduledFor ?? 'Unavailable'}`,
          `Reason: ${result.schedulerResult.message}`
        ].join('\n')
      : 'Unavailable',
    '',
    'Execution Preview:',
    result.executionResult
      ? [
          `Scheduled Job ID: ${result.executionResult.job?.id ?? result.schedulerResult?.job?.id ?? 'Unavailable'}`,
          `Due: ${result.executionResult.due}`,
          `Execution Status: ${result.executionResult.status}`,
          `Attempt Count: ${result.executionResult.attemptCount}`,
          `Retry Count: ${result.executionResult.retryCount}`,
          `Queue Status: ${result.executionResult.queueResult?.item?.status ?? result.queueResult?.item?.status ?? 'Unavailable'}`,
          `Reason: ${result.executionResult.failure?.reason ?? result.executionResult.message}`
        ].join('\n')
      : 'Unavailable',
    '',
    'Audit Timeline:',
    result.auditTimeline && result.auditTimeline.length > 0
      ? result.auditTimeline.map((event, index) =>
          [
            `${index + 1}. ${event.type}`,
            `At: ${event.createdAt}`,
            `Actor: ${event.actor.name ?? event.actor.id}`,
            `Entity: ${event.context.entityType ?? 'unknown'}:${event.context.entityId ?? 'unknown'}`,
            `Message: ${event.message}`
          ].join('\n')
        ).join('\n\n')
      : 'Unavailable',
    '',
    'Retry Metadata:',
    result.retryMetadata
      ? [
          `Status: ${result.retryMetadata.status}`,
          `Attempt Count: ${result.retryMetadata.attemptCount}`,
          `Retry Count: ${result.retryMetadata.retryCount}`,
          `Policy: maxAttempts=${result.retryMetadata.policy.maxAttempts}, fixedDelayMs=${result.retryMetadata.policy.delayMs}`,
          `History: ${result.retryMetadata.attempts.map((attempt) =>
            `#${attempt.attemptNumber}:${attempt.status}${attempt.reason ? `:${attempt.reason.code}` : ''}`
          ).join(' -> ')}`
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

function formatGeneratedArticle(result: Awaited<ReturnType<typeof runMagazineDryRun>>): string {
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

function formatSeoPreview(result: Awaited<ReturnType<typeof runMagazineDryRun>>): string {
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

export function parseDryRunArgs(args: string[]): {
  topic?: string;
  magazine: string;
  aiMode: 'mock' | 'openai' | 'gemini';
  language?: string;
} {
  const topicParts: string[] = [];
  let magazine = process.env.ASTERIA_MAGAZINE || 'cat';
  let aiMode: 'mock' | 'openai' | 'gemini' = parseAIMode(process.env.ASTERIA_AI_MODE);
  let language: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--ai') {
      aiMode = parseAIMode(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--ai=')) {
      aiMode = parseAIMode(arg.slice('--ai='.length));
      continue;
    }

    if (arg === '--magazine') {
      magazine = parseMagazine(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--magazine=')) {
      magazine = parseMagazine(arg.slice('--magazine='.length));
      continue;
    }

    if (arg === '--language') {
      language = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--language=')) {
      language = arg.slice('--language='.length);
      continue;
    }

    topicParts.push(arg);
  }

  return {
    topic: topicParts.join(' ') || undefined,
    magazine,
    aiMode,
    language
  };
}

function parseMagazine(value: string | undefined): string {
  return value && value.trim().length > 0 ? value.trim() : 'cat';
}

function parseAIMode(value: string | undefined): 'mock' | 'openai' | 'gemini' {
  return value === 'openai' || value === 'gemini' ? value : 'mock';
}

function isMainModule(): boolean {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
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
