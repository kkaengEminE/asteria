import { ProviderNotFoundError, ProviderRegistry } from '../../providers/index.ts';
import {
  GeminiProvider,
  type GeminiEnvironment,
  type GeminiTransport,
  MockAIProvider,
  OpenAIProvider,
  type OpenAIEnvironment,
  type OpenAITransport
} from '../../providers/ai/index.ts';
import { GoogleDriveImageLibrary } from '../../providers/image/googleDrive/index.ts';
import {
  CoupangAffiliateProvider,
  createCoupangAffiliateConfigFromEnv,
  type CoupangAffiliateTransport,
  type CoupangEnvironment
} from '../../providers/monetization/coupang/index.ts';
import { AuditLog } from '../../services/auditLog/index.ts';
import { DryRunWorkflowFactory, type DryRunResult } from '../../services/dryRun/index.ts';
import { MetricsService } from '../../services/metrics/index.ts';
import { DryRunPublisher } from '../../services/publisher/index.ts';
import { createMagazineDryRunSteps } from './dryRunSteps.ts';
import {
  createMockResearchProvider,
  mockCatCoupangProductRecords,
  mockCatImageRecords,
  mockDogCoupangProductRecords,
  mockDogImageRecords
} from './mockProviders.ts';
import {
  mockAiProviderToken,
  mockImageLibraryToken,
  mockMonetizationProviderToken,
  mockPublisherToken,
  mockResearchProviderToken
} from './providerTokens.ts';

export interface MagazineDryRunOptions {
  topic?: string;
  magazineSlug?: string;
  language?: string;
  rootDir?: string;
  promptKey?: string;
  aiMode?: MagazineDryRunAIMode;
  openAIEnv?: OpenAIEnvironment;
  openAITransport?: OpenAITransport;
  geminiEnv?: GeminiEnvironment;
  geminiTransport?: GeminiTransport;
  affiliateMode?: MagazineDryRunAffiliateMode;
  coupangEnv?: CoupangEnvironment;
  coupangTransport?: CoupangAffiliateTransport;
  registry?: ProviderRegistry;
  registerMockProviders?: boolean;
}

export type MagazineDryRunAIMode = 'mock' | 'openai' | 'gemini';
export type MagazineDryRunAffiliateMode = 'mock' | 'coupang';

export async function runMagazineDryRun(options: MagazineDryRunOptions = {}): Promise<DryRunResult> {
  const topic = options.topic ?? 'indoor enrichment for cats';
  const magazineSlug = options.magazineSlug ?? 'cat';
  const registry = options.registry ?? new ProviderRegistry();

  if (options.registerMockProviders ?? true) {
    registerMagazineDryRunMockProviders(registry, {
      aiMode: options.aiMode,
      openAIEnv: options.openAIEnv,
      openAITransport: options.openAITransport,
      geminiEnv: options.geminiEnv,
      geminiTransport: options.geminiTransport,
      affiliateMode: options.affiliateMode,
      coupangEnv: options.coupangEnv,
      coupangTransport: options.coupangTransport
    });
  }

  try {
    const researchProvider = await registry.resolve(mockResearchProviderToken, {
      magazineSlug,
      dryRun: true
    });
    const aiProvider = await registry.resolve(mockAiProviderToken, {
      magazineSlug,
      dryRun: true
    });
    const publisher = await registry.resolve(mockPublisherToken, {
      magazineSlug,
      dryRun: true
    });
    const imageLibrary = await registry.resolve(mockImageLibraryToken, {
      magazineSlug,
      dryRun: true
    });
    const monetizationProvider = await registry.resolve(mockMonetizationProviderToken, {
      magazineSlug,
      dryRun: true
    });
    const auditLog = new AuditLog();
    const metricsService = new MetricsService();

    const steps = createMagazineDryRunSteps({
      topic,
      magazineSlug,
      language: options.language,
      rootDir: options.rootDir,
      promptKey: options.promptKey,
      researchProvider,
      aiProvider,
      publisher,
      imageLibrary,
      monetizationProvider,
      auditLog,
      metricsService
    });
    const workflowFactory = new DryRunWorkflowFactory();

    const workflowResult = await workflowFactory.execute({
      workflowName: 'magazine-dry-run',
      workflowId: 'magazine-dry-run',
      magazineSlug,
      topic,
      steps,
      initialData: {
        auditLog,
        metricsService
      }
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
      previewReport: {
        content: {},
        media: {},
        monetization: {},
        channels: [],
        publishing: {},
        observability: {}
      },
      error: describeError(error)
    };
  }
}

export interface RegisterMagazineDryRunMockProviderOptions {
  aiMode?: MagazineDryRunAIMode;
  openAIEnv?: OpenAIEnvironment;
  openAITransport?: OpenAITransport;
  geminiEnv?: GeminiEnvironment;
  geminiTransport?: GeminiTransport;
  affiliateMode?: MagazineDryRunAffiliateMode;
  coupangEnv?: CoupangEnvironment;
  coupangTransport?: CoupangAffiliateTransport;
}

export function registerMagazineDryRunMockProviders(
  registry: ProviderRegistry,
  options: RegisterMagazineDryRunMockProviderOptions = {}
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

      if (options.aiMode === 'gemini') {
        return new GeminiProvider({
          env: options.geminiEnv,
          transport: options.geminiTransport
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
        new DryRunPublisher({
          name: 'mock-publisher'
      })
    );
  }

  if (!registry.has(mockImageLibraryToken)) {
    registry.register(
      mockImageLibraryToken,
      {
        create(context) {
          return new GoogleDriveImageLibrary({
            name: `${context.magazineSlug ?? 'cat'}-google-drive-images`,
            dryRun: true,
            records: context.magazineSlug === 'dog' ? mockDogImageRecords : mockCatImageRecords
          });
        }
      }
    );
  }

  if (!registry.has(mockMonetizationProviderToken)) {
    registry.register(
      mockMonetizationProviderToken,
      {
        create(context) {
          if (options.affiliateMode === 'coupang') {
            return new CoupangAffiliateProvider({
              name: `${context.magazineSlug ?? 'cat'}-coupang-affiliate`,
              ...createCoupangAffiliateConfigFromEnv(options.coupangEnv),
              transport: options.coupangTransport
            });
          }

          return new CoupangAffiliateProvider({
            name: `${context.magazineSlug ?? 'cat'}-coupang-affiliate`,
            dryRun: true,
            records: context.magazineSlug === 'dog' ? mockDogCoupangProductRecords : mockCatCoupangProductRecords
          });
        }
      }
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
