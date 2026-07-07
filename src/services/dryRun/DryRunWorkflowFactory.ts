import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { PublishingResult, ResearchResult } from '../../core/types.ts';
import {
  SequentialWorkflowEngine,
  type WorkflowContext,
  type WorkflowResult,
  type WorkflowStep
} from '../../workflows/index.ts';
import { type DryRunResult, summarizeMagazine } from './DryRunResult.ts';

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
  researchKey?: string;
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

    return {
      magazine: magazineConfig ? summarizeMagazine(magazineConfig) : undefined,
      topic: options.topic,
      workflowStatus: options.workflowResult.status,
      executedSteps: options.workflowResult.steps.map((step) => step.stepName),
      renderedPromptPreview: preview(context.data[options.promptKey ?? 'articlePrompt'], options.previewLength),
      articlePreview: context.data[options.articleKey ?? 'articlePreview'] as string | undefined,
      seoPreview: context.data[options.seoKey ?? 'seoPreview'] as string | undefined,
      publishPreview: context.data[options.publishKey ?? 'publishPreview'] as PublishingResult | undefined,
      researchPreview: context.data[options.researchKey ?? 'researchResults'] as ResearchResult[] | undefined,
      error: options.workflowResult.status === 'failed' ? options.workflowResult.message : undefined
    };
  }
}

function preview(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

