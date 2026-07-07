import { ProviderNotFoundError, ProviderRegistry } from '../../providers/index.ts';
import { WordPressPublisher } from '../../providers/publisher/wordpress/index.ts';
import { DryRunWorkflowFactory, type DryRunResult } from '../../services/dryRun/index.ts';
import { createCatDryRunSteps } from './dryRunSteps.ts';
import { createMockAIProvider, createMockResearchProvider } from './mockProviders.ts';
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

    const steps = createCatDryRunSteps({
      topic,
      rootDir: options.rootDir,
      promptKey: options.promptKey,
      researchProvider,
      aiProvider,
      publisher
    });
    const workflowFactory = new DryRunWorkflowFactory();

    const workflowResult = await workflowFactory.execute({
      workflowName: 'cat-magazine-dry-run',
      workflowId: 'cat-magazine-dry-run',
      magazineSlug: 'cat',
      topic,
      steps
    });

    return workflowFactory.createResult({
      topic,
      workflowResult
    });
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
    registry.register(
      mockPublisherToken,
      () =>
        new WordPressPublisher({
          siteUrl: 'https://example.test',
          dryRun: true
        })
    );
  }
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
