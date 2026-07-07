import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { PublishingResult } from '../../core/types.ts';
import { ProviderNotFoundError, ProviderRegistry } from '../../providers/index.ts';
import { SequentialWorkflowEngine, type WorkflowResult } from '../../workflows/index.ts';
import type { DryRunResult } from './DryRunResult.ts';
import { createCatDryRunSteps, getResearchResults } from './dryRunSteps.ts';
import { createMockAIProvider, createMockPublisher, createMockResearchProvider } from './mockProviders.ts';
import { mockAiProviderToken, mockPublisherToken, mockResearchProviderToken } from './providerTokens.ts';

export interface CatMagazineDryRunOptions {
  topic?: string;
  rootDir?: string;
  promptKey?: string;
  registry?: ProviderRegistry;
  registerMockProviders?: boolean;
}

export async function runCatMagazineDryRun(options: CatMagazineDryRunOptions = {}): Promise<DryRunResult> {
  const topic = options.topic ?? 'indoor enrichment for cats';
  const registry = options.registry ?? new ProviderRegistry();

  if (options.registerMockProviders ?? true) {
    registerCatDryRunMockProviders(registry);
  }

  try {
    const researchProvider = await registry.resolve(mockResearchProviderToken, {
      magazineSlug: 'cat',
      dryRun: true
    });
    const aiProvider = await registry.resolve(mockAiProviderToken, {
      magazineSlug: 'cat',
      dryRun: true
    });
    const publisher = await registry.resolve(mockPublisherToken, {
      magazineSlug: 'cat',
      dryRun: true
    });

    const engine = new SequentialWorkflowEngine({ name: 'cat-magazine-dry-run' });
    const steps = createCatDryRunSteps({
      topic,
      rootDir: options.rootDir,
      promptKey: options.promptKey,
      researchProvider,
      aiProvider,
      publisher
    });

    for (const step of steps) {
      engine.register(step);
    }

    const workflowResult = await engine.execute({
      workflowId: 'cat-magazine-dry-run',
      magazineSlug: 'cat',
      dryRun: true,
      data: {
        topic
      }
    });

    return toDryRunResult(topic, workflowResult);
  } catch (error) {
    return {
      topic,
      workflowStatus: 'failed',
      executedSteps: [],
      error: describeError(error)
    };
  }
}

export function registerCatDryRunMockProviders(registry: ProviderRegistry): void {
  if (!registry.has(mockResearchProviderToken)) {
    registry.register(mockResearchProviderToken, () => createMockResearchProvider());
  }

  if (!registry.has(mockAiProviderToken)) {
    registry.register(mockAiProviderToken, () => createMockAIProvider());
  }

  if (!registry.has(mockPublisherToken)) {
    registry.register(mockPublisherToken, () => createMockPublisher());
  }
}

function toDryRunResult(topic: string, workflowResult: WorkflowResult): DryRunResult {
  const magazineConfig = workflowResult.context.data.magazineConfig as MagazineConfig | undefined;

  return {
    magazine: magazineConfig
      ? {
          name: magazineConfig.name,
          slug: magazineConfig.slug,
          language: magazineConfig.language
        }
      : undefined,
    topic,
    workflowStatus: workflowResult.status,
    executedSteps: workflowResult.steps.map((step) => step.stepName),
    renderedPromptPreview: preview(workflowResult.context.data.articlePrompt),
    generatedMockArticle: workflowResult.context.data.generatedArticle as string | undefined,
    seoPreview: workflowResult.context.data.seoPreview as string | undefined,
    publishPreview: workflowResult.context.data.publishPreview as PublishingResult | undefined,
    researchPreview: getResearchResults(workflowResult.context),
    error: workflowResult.status === 'failed' ? workflowResult.message : undefined
  };
}

function preview(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

function describeError(error: unknown): string {
  if (error instanceof ProviderNotFoundError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

