import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { PublishingResult, ResearchResult } from '../../core/types.ts';
import type { AuditEvent } from '../../domain/audit/index.ts';
import type { PublishingPackage } from '../../domain/content/index.ts';
import type { PublishingQueueResult } from '../../domain/publishingQueue/index.ts';
import type { RetryResult } from '../../domain/retry/index.ts';
import type { JobExecutionResult, ScheduleResult } from '../../domain/scheduler/index.ts';
import type { ImageAsset } from '../../domain/image/index.ts';
import type { AffiliateLink, Recommendation } from '../../domain/monetization/index.ts';
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
  auditTimelineKey?: string;
  retryMetadataKey?: string;
  researchKey?: string;
  selectedImageKey?: string;
  imageSelectionReasonKey?: string;
  recommendationsKey?: string;
  affiliateLinksKey?: string;
  monetizationPreviewKey?: string;
  affiliateDisclosureKey?: string;
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

    return {
      magazine: magazineConfig ? summarizeMagazine(magazineConfig) : undefined,
      topic: options.topic,
      workflowStatus: options.workflowResult.status,
      executedSteps: options.workflowResult.steps.map((step) => step.stepName),
      renderedPromptPreview: preview(context.data[options.promptKey ?? 'articlePrompt'], options.previewLength),
      articlePreview: context.data[options.articleKey ?? 'articlePreview'] as string | undefined,
      seoPreview: context.data[options.seoKey ?? 'seoPreview'] as string | undefined,
      publishPreview: context.data[options.publishKey ?? 'publishPreview'] as PublishingResult | undefined,
      queueResult: context.data[options.queueResultKey ?? 'queueResult'] as PublishingQueueResult | undefined,
      schedulerResult: context.data[options.schedulerResultKey ?? 'schedulerResult'] as ScheduleResult | undefined,
      executionResult: context.data[options.executionResultKey ?? 'executionResult'] as JobExecutionResult | undefined,
      auditTimeline: context.data[options.auditTimelineKey ?? 'auditTimeline'] as AuditEvent[] | undefined,
      retryMetadata: context.data[options.retryMetadataKey ?? 'retryMetadata'] as RetryResult | undefined,
      researchPreview: context.data[options.researchKey ?? 'researchResults'] as ResearchResult[] | undefined,
      selectedImage: selectedImage ? summarizeImage(selectedImage) : undefined,
      imageSelectionReason: context.data[options.imageSelectionReasonKey ?? 'imageSelectionReason'] as
        | DryRunImageSelectionReason
        | undefined,
      imagePreview: selectedImage?.uri,
      recommendedProducts: recommendations ? summarizeRecommendations(recommendations) : undefined,
      affiliateLinks: context.data[options.affiliateLinksKey ?? 'affiliateLinks'] as AffiliateLink[] | undefined,
      monetizationPreview: context.data[options.monetizationPreviewKey ?? 'monetizationPreview'] as string | undefined,
      affiliateDisclosure: context.data[options.affiliateDisclosureKey ?? 'affiliateDisclosure'] as string | undefined,
      publishingPackage: context.data.publishingPackage as PublishingPackage | undefined,
      contentGenerationMetadata: context.data.contentGenerationMetadata as DryRunResult['contentGenerationMetadata'],
      error:
        options.workflowResult.status === 'failed'
          ? describeWorkflowError(options.workflowResult)
          : undefined
    };
  }
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
