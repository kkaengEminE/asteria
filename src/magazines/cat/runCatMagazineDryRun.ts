import { ProviderNotFoundError, ProviderRegistry } from '../../providers/index.ts';
import {
  MockAIProvider,
  OpenAIProvider,
  type OpenAIEnvironment,
  type OpenAITransport
} from '../../providers/ai/index.ts';
import { GoogleDriveImageLibrary } from '../../providers/image/googleDrive/index.ts';
import { CoupangAffiliateProvider } from '../../providers/monetization/coupang/index.ts';
import { WordPressPublisher } from '../../providers/publisher/wordpress/index.ts';
import { DryRunWorkflowFactory, type DryRunResult } from '../../services/dryRun/index.ts';
import { createCatDryRunSteps } from './dryRunSteps.ts';
import {
  createMockResearchProvider,
  mockCatCoupangProductRecords,
  mockCatImageRecords
} from './mockProviders.ts';
import {
  mockAiProviderToken,
  mockImageLibraryToken,
  mockMonetizationProviderToken,
  mockPublisherToken,
  mockResearchProviderToken
} from './providerTokens.ts';

export interface CatMagazineDryRunOptions {
  topic?: string;
  rootDir?: string;
  promptKey?: string;
  aiMode?: CatDryRunAIMode;
  openAIEnv?: OpenAIEnvironment;
  openAITransport?: OpenAITransport;
  registry?: ProviderRegistry;
  registerMockProviders?: boolean;
}

export type CatDryRunAIMode = 'mock' | 'openai';

export async function runCatMagazineDryRun(options: CatMagazineDryRunOptions = {}): Promise<DryRunResult> {
  const topic = options.topic ?? 'indoor enrichment for cats';
  const registry = options.registry ?? new ProviderRegistry();

  if (options.registerMockProviders ?? true) {
    registerCatDryRunMockProviders(registry, {
      aiMode: options.aiMode,
      openAIEnv: options.openAIEnv,
      openAITransport: options.openAITransport
    });
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
    const imageLibrary = await registry.resolve(mockImageLibraryToken, {
      magazineSlug: 'cat',
      dryRun: true
    });
    const monetizationProvider = await registry.resolve(mockMonetizationProviderToken, {
      magazineSlug: 'cat',
      dryRun: true
    });

    const steps = createCatDryRunSteps({
      topic,
      rootDir: options.rootDir,
      promptKey: options.promptKey,
      researchProvider,
      aiProvider,
      publisher,
      imageLibrary,
      monetizationProvider
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

export interface RegisterCatDryRunMockProviderOptions {
  aiMode?: CatDryRunAIMode;
  openAIEnv?: OpenAIEnvironment;
  openAITransport?: OpenAITransport;
}

export function registerCatDryRunMockProviders(
  registry: ProviderRegistry,
  options: RegisterCatDryRunMockProviderOptions = {}
): void {
  if (!registry.has(mockResearchProviderToken)) {
    registry.register(mockResearchProviderToken, () => createMockResearchProvider());
  }

  if (!registry.has(mockAiProviderToken)) {
    registry.register(mockAiProviderToken, () => {
      if (options.aiMode === 'openai') {
        return new OpenAIProvider({
          env: options.openAIEnv,
          transport: options.openAITransport
        });
      }

      return new MockAIProvider({
        name: 'mock-ai',
        model: 'mock-model'
      });
    });
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

  if (!registry.has(mockImageLibraryToken)) {
    registry.register(
      mockImageLibraryToken,
      () =>
        new GoogleDriveImageLibrary({
          name: 'cat-google-drive-images',
          dryRun: true,
          records: mockCatImageRecords
        })
    );
  }

  if (!registry.has(mockMonetizationProviderToken)) {
    registry.register(
      mockMonetizationProviderToken,
      () =>
        new CoupangAffiliateProvider({
          name: 'cat-coupang-affiliate',
          dryRun: true,
          records: mockCatCoupangProductRecords
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
