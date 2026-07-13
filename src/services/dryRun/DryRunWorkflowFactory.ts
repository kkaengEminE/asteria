import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { ResearchResult } from '../../core/types.ts';
import type { AuditEvent } from '../../domain/audit/index.ts';
import type { PublishingPackage } from '../../domain/content/index.ts';
import type { InstagramContentPackage } from '../../domain/instagram/index.ts';
import type { MetricSnapshot } from '../../domain/metrics/index.ts';
import type { PodcastContentPackage } from '../../domain/podcast/index.ts';
import type { ChannelPreview } from '../../domain/preview/index.ts';
import type { PublishingQueueResult } from '../../domain/publishingQueue/index.ts';
import type { PublishResult } from '../../domain/publisher/index.ts';
import type { RetryResult } from '../../domain/retry/index.ts';
import type { JobExecutionResult, ScheduleResult } from '../../domain/scheduler/index.ts';
import type { ImageAsset } from '../../domain/image/index.ts';
import type { AffiliateLink, MonetizationProviderDiagnostics, Recommendation } from '../../domain/monetization/index.ts';
import {
  SequentialWorkflowEngine,
  type WorkflowContext,
  type WorkflowResult,
  type WorkflowStep
} from '../../workflows/index.ts';
import {
  type DryRunImageSelectionReason,
  type DryRunResult,
  summarizeImage,
  summarizeMagazine,
  summarizeRecommendations
} from './DryRunResult.ts';

export interface BuildDryRunWorkflowOptions {
  workflowName: string;
  steps: WorkflowStep[];
}

export interface ExecuteDryRunWorkflowOptions extends BuildDryRunWorkflowOptions {
  workflowId: string;
  magazineSlug?: string;
  topic: string;
  initialData?: Record<string, unknown>;
}

export interface CreateDryRunResultOptions {
  topic: string;
  workflowResult: WorkflowResult;
  promptKey?: string;
  articleKey?: string;
  seoKey?: string;
  publishKey?: string;
  queueResultKey?: string;
  schedulerResultKey?: string;
  executionResultKey?: string;
  publisherResultKey?: string;
  metricsSnapshotKey?: string;
  auditTimelineKey?: string;
  retryMetadataKey?: string;
  researchKey?: string;
  selectedImageKey?: string;
  imageSelectionReasonKey?: string;
  recommendationsKey?: string;
  affiliateLinksKey?: string;
  monetizationDiagnosticsKey?: string;
  monetizationPreviewKey?: string;
  affiliateDisclosureKey?: string;
  instagramPreviewKey?: string;
  podcastPreviewKey?: string;
  magazineConfigKey?: string;
  previewLength?: number;
}

export class DryRunWorkflowFactory {
  buildWorkflow(options: BuildDryRunWorkflowOptions): SequentialWorkflowEngine {
    const engine = new SequentialWorkflowEngine({ name: options.workflowName });

    for (const step of options.steps) {
      engine.register(step);
    }

    return engine;
  }

  async execute(options: ExecuteDryRunWorkflowOptions): Promise<WorkflowResult> {
    const engine = this.buildWorkflow({
      workflowName: options.workflowName,
      steps: options.steps
    });
    const initialContext: WorkflowContext = {
      workflowId: options.workflowId,
      magazineSlug: options.magazineSlug,
      dryRun: true,
      data: {
        topic: options.topic,
        ...options.initialData
      }
    };

    return engine.execute(initialContext);
  }

  createResult(options: CreateDryRunResultOptions): DryRunResult {
    const context = options.workflowResult.context;
    const magazineConfig = context.data[options.magazineConfigKey ?? 'magazineConfig'] as MagazineConfig | undefined;
    const selectedImage = context.data[options.selectedImageKey ?? 'selectedImage'] as ImageAsset | undefined;
    const recommendations = context.data[options.recommendationsKey ?? 'recommendations'] as Recommendation[] | undefined;
    const renderedPromptPreview = preview(context.data[options.promptKey ?? 'articlePrompt'], options.previewLength);
    const articlePreview = context.data[options.articleKey ?? 'articlePreview'] as string | undefined;
    const seoPreview = context.data[options.seoKey ?? 'seoPreview'] as string | undefined;
    const publishPreview = context.data[options.publishKey ?? 'publishPreview'] as PublishResult | undefined;
    const queueResult = context.data[options.queueResultKey ?? 'queueResult'] as PublishingQueueResult | undefined;
    const schedulerResult = context.data[options.schedulerResultKey ?? 'schedulerResult'] as ScheduleResult | undefined;
    const executionResult = context.data[options.executionResultKey ?? 'executionResult'] as JobExecutionResult | undefined;
    const publisherResult = context.data[options.publisherResultKey ?? 'publisherResult'] as PublishResult | undefined;
    const metricsSnapshot = context.data[options.metricsSnapshotKey ?? 'metricsSnapshot'] as MetricSnapshot | undefined;
    const auditTimeline = context.data[options.auditTimelineKey ?? 'auditTimeline'] as AuditEvent[] | undefined;
    const retryMetadata = context.data[options.retryMetadataKey ?? 'retryMetadata'] as RetryResult | undefined;
    const researchPreview = context.data[options.researchKey ?? 'researchResults'] as ResearchResult[] | undefined;
    const imageSelectionReason = context.data[options.imageSelectionReasonKey ?? 'imageSelectionReason'] as
      | DryRunImageSelectionReason
      | undefined;
    const selectedImageSummary = selectedImage ? summarizeImage(selectedImage) : undefined;
    const recommendedProducts = recommendations ? summarizeRecommendations(recommendations) : undefined;
    const affiliateLinks = context.data[options.affiliateLinksKey ?? 'affiliateLinks'] as AffiliateLink[] | undefined;
    const monetizationDiagnostics = context.data[
      options.monetizationDiagnosticsKey ?? 'monetizationDiagnostics'
    ] as MonetizationProviderDiagnostics | undefined;
    const monetizationPreview = context.data[options.monetizationPreviewKey ?? 'monetizationPreview'] as string | undefined;
    const affiliateDisclosure = context.data[options.affiliateDisclosureKey ?? 'affiliateDisclosure'] as string | undefined;
    const publishingPackage = context.data.publishingPackage as PublishingPackage | undefined;
    const contentGenerationMetadata = context.data.contentGenerationMetadata as DryRunResult['contentGenerationMetadata'];
    const channelPreviews = createChannelPreviews({
      instagramPreview: context.data[options.instagramPreviewKey ?? 'instagramPreview'] as
        | InstagramContentPackage
        | undefined,
      podcastPreview: context.data[options.podcastPreviewKey ?? 'podcastPreview'] as
        | PodcastContentPackage
        | undefined
    });
    const previewReport = {
      content: {
        renderedPromptPreview,
        articlePreview,
        seoPreview,
        publishingPackage,
        researchPreview,
        metadata: contentGenerationMetadata
      },
      media: {
        selectedImage: selectedImageSummary,
        imageSelectionReason,
        imagePreview: selectedImage?.uri
      },
      monetization: {
        recommendedProducts,
        affiliateLinks,
        diagnostics: monetizationDiagnostics,
        preview: monetizationPreview,
        disclosure: affiliateDisclosure
      },
      channels: channelPreviews,
      publishing: {
        publishPreview,
        queueResult,
        schedulerResult,
        executionResult,
        publisherResult
      },
      observability: {
        metricsSnapshot,
        auditTimeline,
        retryMetadata
      }
    };

    return {
      magazine: magazineConfig ? summarizeMagazine(magazineConfig) : undefined,
      topic: options.topic,
      workflowStatus: options.workflowResult.status,
      executedSteps: options.workflowResult.steps.map((step) => step.stepName),
      previewReport,
      renderedPromptPreview,
      articlePreview,
      seoPreview,
      publishPreview,
      queueResult,
      schedulerResult,
      executionResult,
      publisherResult,
      metricsSnapshot,
      auditTimeline,
      retryMetadata,
      researchPreview,
      selectedImage: selectedImageSummary,
      imageSelectionReason,
      imagePreview: selectedImage?.uri,
      recommendedProducts,
      affiliateLinks,
      monetizationDiagnostics,
      monetizationPreview,
      affiliateDisclosure,
      publishingPackage,
      contentGenerationMetadata,
      error:
        options.workflowResult.status === 'failed'
          ? describeWorkflowError(options.workflowResult)
          : undefined
    };
  }
}

function createChannelPreviews(input: {
  instagramPreview?: InstagramContentPackage;
  podcastPreview?: PodcastContentPackage;
}): ChannelPreview[] {
  const previews: ChannelPreview[] = [];

  if (input.instagramPreview) {
    previews.push({
      id: 'instagram',
      title: 'Instagram Preview',
      type: 'channel',
      channel: 'instagram',
      payload: input.instagramPreview
    });
  }

  if (input.podcastPreview) {
    previews.push({
      id: 'podcast',
      title: 'Podcast Preview',
      type: 'channel',
      channel: 'podcast',
      payload: input.podcastPreview
    });
  }

  return previews;
}

function preview(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function describeWorkflowError(workflowResult: WorkflowResult): string | undefined {
  const failedStep = workflowResult.steps.find((step) => step.status === 'failed');

  if (!failedStep) {
    return workflowResult.message;
  }

  return [workflowResult.message, failedStep.error].filter(Boolean).join(': ');
}
