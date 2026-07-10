import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import type {
  AIProvider,
  AIRequest,
  AIResponse,
  AIUsage,
  OpenAIConfig,
  OpenAITransport,
  OpenAITransportRequest,
  OpenAITransportResponse
} from '../src/providers/ai/index.ts';
import type {
  CoupangAffiliateLinkTransportRequest,
  CoupangAffiliateTransport,
  CoupangAffiliateTransportRequest,
  CoupangProductRecord
} from '../src/providers/monetization/coupang/index.ts';
import { ProviderRegistry } from '../src/providers/index.ts';
import {
  registerCatDryRunMockProviders,
  runCatMagazineDryRun
} from '../src/magazines/cat/index.ts';
import {
  mockAiProviderToken,
  mockImageLibraryToken,
  mockMonetizationProviderToken
} from '../src/magazines/cat/providerTokens.ts';

test('cat magazine dry run succeeds', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment' });

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.magazine?.slug, 'cat');
  assert.deepEqual(result.executedSteps, [
    'Load Config',
    'Load Prompt',
    'Research',
    'Generate Publishing Package',
    'Select Image',
    'Generate Article',
    'Generate SEO',
    'Generate Monetization Preview',
    'Publish Preview',
    'Schedule Preview',
    'Execution Preview'
  ]);
  assert.match(result.renderedPromptPreview ?? '', /indoor enrichment/);
  assert.match(result.articlePreview ?? '', /Mock Cat Care Article/);
  assert.match(result.seoPreview ?? '', /Title Tag/);
  assert.equal(result.publishPreview?.status, 'skipped');
  assert.match(result.publishPreview?.message ?? '', /requires APPROVED content/);
  assert.equal(result.selectedImage?.filename, 'cat-window-enrichment.jpg');
  assert.match(result.imagePreview ?? '', /^mock:\/\//);
  assert.match(result.monetizationPreview ?? '', /Interactive Cat Enrichment Toy/);
});

test('cat magazine dry run keeps mock ai as default', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment' });

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.contentGenerationMetadata?.providerName, 'mock-ai');
  assert.equal(result.contentGenerationMetadata?.modelName, 'mock-model');
  assert.equal(typeof result.contentGenerationMetadata?.reviewScore, 'number');
  assert.match(result.contentGenerationMetadata?.reviewSummary ?? '', /Editorial review/);
  assert.equal(typeof result.contentGenerationMetadata?.realGenerationReview, 'object');
  assert.match(result.contentGenerationMetadata?.realGenerationThresholdResult ?? '', /PASS|WARNING|FAIL/);
  assert.equal(typeof result.contentGenerationMetadata?.approvalResult, 'object');
  assert.match(result.contentGenerationMetadata?.approvalDecision ?? '', /APPROVED|NEEDS_REVIEW|REJECTED/);
});

test('cat magazine dry run production ai is disabled by default', async () => {
  const transport = new MockOpenAITransport({
    status: 200,
    body: {
      output_text: JSON.stringify(createOpenAIPackageFixture())
    }
  });
  const result = await runCatMagazineDryRun({
    topic: 'indoor enrichment',
    aiMode: 'openai',
    openAIEnv: {},
    openAITransport: transport
  });

  assert.equal(result.workflowStatus, 'failed');
  assert.match(result.error ?? '', /OpenAI production mode is disabled/);
  assert.equal(transport.calls.length, 0);
});

test('cat magazine dry run production ai requires api key', async () => {
  const transport = new MockOpenAITransport({
    status: 200,
    body: {
      output_text: JSON.stringify(createOpenAIPackageFixture())
    }
  });
  const result = await runCatMagazineDryRun({
    topic: 'indoor enrichment',
    aiMode: 'openai',
    openAIEnv: {
      OPENAI_PRODUCTION_ENABLED: 'true'
    },
    openAITransport: transport
  });

  assert.equal(result.workflowStatus, 'failed');
  assert.match(result.error ?? '', /OpenAI API key is missing/);
  assert.equal(transport.calls.length, 0);
});

test('cat magazine dry run passes rendered prompt assets to openai provider', async () => {
  const transport = new MockOpenAITransport({
    status: 200,
    body: {
      id: 'response-cat-openai',
      model: 'test-model',
      output_text: JSON.stringify(createOpenAIPackageFixture()),
      usage: {
        input_tokens: 5,
        output_tokens: 7,
        total_tokens: 12
      }
    }
  });
  const result = await runCatMagazineDryRun({
    topic: 'indoor enrichment',
    aiMode: 'openai',
    openAIEnv: {
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'test-model',
      OPENAI_BASE_URL: 'https://api.openai.test/v1',
      OPENAI_PRODUCTION_ENABLED: 'true'
    },
    openAITransport: transport
  });
  const requestBody = transport.calls[0].body as {
    input: Array<{ content: string }>;
  };

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.contentGenerationMetadata?.providerName, 'openai');
  assert.equal(result.contentGenerationMetadata?.modelName, 'test-model');
  assert.equal((result.contentGenerationMetadata?.tokenUsage as { totalTokens?: number }).totalTokens, 12);
  assert.match(requestBody.input.map((item) => item.content).join('\n'), /content\.task@v1/);
  assert.match(requestBody.input.map((item) => item.content).join('\n'), /content\.outputSchema@v1/);
  assert.match(requestBody.input.map((item) => item.content).join('\n'), /indoor enrichment/);
});

test('cat magazine dry run fails when config is missing', async () => {
  const emptyRoot = await mkdtemp(join(tmpdir(), 'asteria-missing-config-'));
  const result = await runCatMagazineDryRun({
    rootDir: emptyRoot,
    topic: 'missing config'
  });

  assert.equal(result.workflowStatus, 'failed');
  assert.deepEqual(result.executedSteps, ['Load Config']);
  assert.match(result.error ?? '', /Load Config/);
});

test('cat magazine dry run fails when prompt is missing', async () => {
  const result = await runCatMagazineDryRun({
    topic: 'missing prompt',
    promptKey: 'missing-prompt'
  });

  assert.equal(result.workflowStatus, 'failed');
  assert.deepEqual(result.executedSteps, ['Load Config', 'Load Prompt']);
  assert.match(result.error ?? '', /Load Prompt/);
});

test('cat magazine dry run fails when provider resolution fails', async () => {
  const result = await runCatMagazineDryRun({
    topic: 'provider failure',
    registerMockProviders: false
  });

  assert.equal(result.workflowStatus, 'failed');
  assert.deepEqual(result.executedSteps, []);
  assert.match(result.error ?? '', /Provider not found/);
});

test('cat magazine dry run returns workflow failure when a step provider fails', async () => {
  const registry = new ProviderRegistry();
  registerCatDryRunMockProviders(registry);
  registry.remove(mockAiProviderToken);
  registry.register(mockAiProviderToken, () => createFailingAIProvider());

  const result = await runCatMagazineDryRun({
    topic: 'workflow failure',
    registry,
    registerMockProviders: false
  });

  assert.equal(result.workflowStatus, 'failed');
  assert.deepEqual(result.executedSteps, ['Load Config', 'Load Prompt', 'Research', 'Generate Publishing Package']);
  assert.match(result.error ?? '', /Generate Publishing Package/);
});

test('cat magazine dry run image selection uses topic and tags', async () => {
  const result = await runCatMagazineDryRun({ topic: 'cat toy enrichment play' });

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.selectedImage?.filename, 'cat-window-enrichment.jpg');
  assert.ok(result.selectedImage?.tags.includes('enrichment'));
  assert.ok(result.selectedImage?.tags.includes('toy'));
  assert.match(result.imageSelectionReason?.reasons.join(' ') ?? '', /matched tags/);
});

test('cat magazine dry run includes image preview', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment' });

  assert.equal(result.selectedImage?.category, 'hero');
  assert.ok((result.imageSelectionReason?.score ?? 0) > 0);
  assert.equal(result.imagePreview, 'mock://google-drive/cat-window-enrichment.jpg');
});

test('cat magazine dry run fails gracefully when image provider is missing', async () => {
  const registry = new ProviderRegistry();
  registerCatDryRunMockProviders(registry);
  registry.remove(mockImageLibraryToken);

  const result = await runCatMagazineDryRun({
    topic: 'indoor enrichment',
    registry,
    registerMockProviders: false
  });

  assert.equal(result.workflowStatus, 'failed');
  assert.deepEqual(result.executedSteps, []);
  assert.match(result.error ?? '', /Provider not found/);
});

test('cat magazine dry run image preview makes no external api call', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment' });

  assert.match(result.imagePreview ?? '', /^mock:\/\//);
  assert.equal(result.selectedImage?.id, 'cat-window-enrichment');
});

test('cat magazine dry run includes monetization preview', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment' });

  assert.equal(result.workflowStatus, 'success');
  assert.ok((result.recommendedProducts?.length ?? 0) > 0);
  assert.match(result.monetizationPreview ?? '', /Interactive Cat Enrichment Toy/);
  assert.match(result.affiliateDisclosure ?? '', /Mock affiliate links/);
});

test('cat magazine dry run recommendations use topic and tags', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment toy play' });

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.recommendedProducts?.[0].name, 'Interactive Cat Enrichment Toy');
  assert.ok(result.recommendedProducts?.[0].tags.includes('enrichment'));
  assert.ok(result.recommendedProducts?.[0].tags.includes('toy'));
});

test('cat magazine dry run generates mock affiliate links', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment' });

  assert.ok((result.affiliateLinks?.length ?? 0) > 0);
  assert.ok(result.affiliateLinks?.every((link) => link.url.startsWith('mock://')));
  assert.ok(result.affiliateLinks?.every((link) => link.metadata?.dryRun === true));
});

test('cat magazine dry run fails gracefully when monetization provider is missing', async () => {
  const registry = new ProviderRegistry();
  registerCatDryRunMockProviders(registry);
  registry.remove(mockMonetizationProviderToken);

  const result = await runCatMagazineDryRun({
    topic: 'indoor enrichment',
    registry,
    registerMockProviders: false
  });

  assert.equal(result.workflowStatus, 'failed');
  assert.deepEqual(result.executedSteps, []);
  assert.match(result.error ?? '', /Provider not found/);
});

test('cat magazine dry run monetization makes no external api call', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment' });

  assert.ok(result.affiliateLinks?.every((link) => link.url.startsWith('mock://')));
  assert.doesNotMatch(result.affiliateLinks?.[0].url ?? '', /^https?:\/\//);
});

test('cat magazine dry run production coupang mode is disabled by default', async () => {
  const transport = new MockCoupangTransport();
  const result = await runCatMagazineDryRun({
    topic: 'indoor enrichment',
    affiliateMode: 'coupang',
    coupangEnv: {},
    coupangTransport: transport
  });

  assert.equal(result.workflowStatus, 'failed');
  assert.match(result.error ?? '', /Coupang production mode is disabled/);
  assert.equal(transport.searchCalls.length, 0);
});

test('cat magazine dry run can use mocked production coupang provider', async () => {
  const transport = new MockCoupangTransport();
  const result = await runCatMagazineDryRun({
    topic: 'indoor enrichment',
    affiliateMode: 'coupang',
    coupangEnv: {
      COUPANG_ENABLED: 'true',
      COUPANG_ACCESS_KEY: 'test-access-key',
      COUPANG_SECRET_KEY: 'test-secret-key',
      COUPANG_PARTNER_ID: 'test-partner-id',
      COUPANG_BASE_URL: 'https://coupang.test'
    },
    coupangTransport: transport
  });

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.monetizationDiagnostics?.productionEnabled, true);
  assert.equal(result.monetizationDiagnostics?.requestCount, 4);
  assert.ok((result.monetizationDiagnostics?.returnedProductCount ?? 0) > 0);
  assert.ok(result.affiliateLinks?.every((link) => link.url.startsWith('https://cou.pang/affiliate/')));
});

function createFailingAIProvider(): AIProvider {
  return {
    name: 'failing-ai',
    async generatePublishingPackage() {
      throw new Error('Mock AI failure.');
    },
    async generate(_request: AIRequest): Promise<AIResponse> {
      throw new Error('Mock AI failure.');
    },
    async *stream(_request: AIRequest): AsyncIterable<AIResponse> {
      throw new Error('Mock AI failure.');
    },
    async countTokens(_request: AIRequest): Promise<AIUsage> {
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
    },
    async healthCheck() {
      return {
        ok: false,
        provider: 'failing-ai',
        message: 'Mock AI failure.'
      };
    }
  };
}

function createOpenAIPackageFixture() {
  return {
    article: {
      title: 'OpenAI Cat Article',
      summary: 'A provider-neutral article summary.',
      body: 'A provider-neutral article body.',
      slug: 'openai-cat-article',
      language: 'en-US',
      author: 'Asteria',
      createdAt: '2026-07-08T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: []
      }
    },
    summary: {
      text: 'A provider-neutral dry-run summary.'
    },
    seo: {
      metaTitle: 'OpenAI Cat Article',
      metaDescription: 'A provider-neutral SEO description.',
      keywords: ['cat', 'openai']
    },
    faq: [
      {
        question: 'Is this published?',
        answer: 'No. This is still a dry-run package.'
      }
    ],
    imagePrompt: {
      prompt: 'Find an editorial cat image.'
    },
    productPrompt: {
      prompt: 'Find safe cat product ideas.'
    }
  };
}

class MockOpenAITransport implements OpenAITransport {
  readonly calls: OpenAITransportRequest[] = [];
  private readonly response: OpenAITransportResponse;

  constructor(response: OpenAITransportResponse) {
    this.response = response;
  }

  async request(_config: OpenAIConfig, request: OpenAITransportRequest): Promise<OpenAITransportResponse> {
    this.calls.push(request);
    return this.response;
  }
}

class MockCoupangTransport implements CoupangAffiliateTransport {
  readonly searchCalls: CoupangAffiliateTransportRequest[] = [];
  readonly linkCalls: CoupangAffiliateLinkTransportRequest[] = [];

  async searchProducts(request: CoupangAffiliateTransportRequest) {
    this.searchCalls.push(request);

    return {
      products: mockCoupangRecords
    };
  }

  async generateAffiliateLink(request: CoupangAffiliateLinkTransportRequest) {
    this.linkCalls.push(request);

    return {
      url: `https://cou.pang/affiliate/${request.productId}`
    };
  }
}

const mockCoupangRecords: CoupangProductRecord[] = [
  {
    id: 'cat-enrichment-toy',
    productName: 'Interactive Cat Enrichment Toy',
    productDescription: 'Production-style Coupang product fixture for cat enrichment.',
    categoryName: 'cat-care',
    keywords: ['cat', 'enrichment', 'toy'],
    priceAmount: 19900,
    currency: 'KRW',
    rating: 4.7,
    productUrl: 'https://www.coupang.test/products/cat-enrichment-toy',
    coupangProductId: 'prod-cat-enrichment-toy',
    mockUri: 'mock://coupang/products/cat-enrichment-toy'
  },
  {
    id: 'cat-window-perch',
    productName: 'Cat Window Perch',
    productDescription: 'Production-style Coupang product fixture for indoor enrichment.',
    categoryName: 'cat-care',
    keywords: ['cat', 'enrichment', 'window'],
    priceAmount: 33900,
    currency: 'KRW',
    rating: 4.5,
    productUrl: 'https://www.coupang.test/products/cat-window-perch',
    coupangProductId: 'prod-cat-window-perch',
    mockUri: 'mock://coupang/products/cat-window-perch'
  },
  {
    id: 'cat-puzzle-feeder',
    productName: 'Cat Puzzle Feeder',
    productDescription: 'Production-style Coupang product fixture for food enrichment.',
    categoryName: 'cat-care',
    keywords: ['cat', 'enrichment', 'food'],
    priceAmount: 28900,
    currency: 'KRW',
    rating: 4.8,
    productUrl: 'https://www.coupang.test/products/cat-puzzle-feeder',
    coupangProductId: 'prod-cat-puzzle-feeder',
    mockUri: 'mock://coupang/products/cat-puzzle-feeder'
  }
];
