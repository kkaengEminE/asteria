import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MockAIProvider,
  OpenAIProvider,
  type AIRequest,
  type AIResponse,
  type AIUsage,
  type OpenAIConfig,
  type OpenAITransport,
  type OpenAITransportRequest,
  type OpenAITransportResponse
} from '../src/providers/ai/index.ts';
import type { AIHealthCheckResult, AIProvider } from '../src/providers/ai/AIProvider.ts';
import {
  PublishingPackageValidationError,
  createPublishingPackage,
  type ContentRequest,
  type PublishingPackage
} from '../src/domain/content/index.ts';
import { ContentGenerationWorkflow } from '../src/workflows/index.ts';
import { runCatMagazineDryRun } from '../src/magazines/cat/index.ts';
import {
  StructuredOutputError,
  StructuredOutputParser,
  StructuredOutputValidator
} from '../src/services/structuredOutput/index.ts';
import { PromptAssetRegistry } from '../src/prompts/index.ts';

test('content generation workflow returns a publishing package', async () => {
  const workflow = new ContentGenerationWorkflow({
    aiProvider: new MockAIProvider()
  });
  const result = await workflow.execute(createRequest());

  assert.equal(result.article.title, 'Mock Article: 고양이가 밤에 뛰어다니는 이유');
  assert.equal(result.faq.length, 1);
  assert.match(result.imagePrompt.prompt, /고양이가 밤에 뛰어다니는 이유/);
  assert.match(result.productPrompt.prompt, /고양이가 밤에 뛰어다니는 이유/);
});

test('mock provider generates every publishing package section', async () => {
  const provider = new MockAIProvider();
  const result = await provider.generatePublishingPackage(createRequest());

  assert.ok(result.article.body.length > 0);
  assert.ok(result.summary.text.length > 0);
  assert.ok(result.seo.metaTitle.length > 0);
  assert.ok(result.faq.length > 0);
  assert.ok(result.imagePrompt.prompt.length > 0);
  assert.ok(result.productPrompt.prompt.length > 0);
  assert.equal(result.metadata?.dryRun, true);
});

test('openai provider maps mocked publishing package JSON', async () => {
  const transport = new MockOpenAITransport({
    status: 200,
    body: {
      id: 'response-package',
      model: 'test-model',
      output_text: JSON.stringify(createPackageFixture()),
      status: 'completed',
      usage: {
        input_tokens: 50,
        output_tokens: 120,
        total_tokens: 170
      }
    }
  });
  const provider = new OpenAIProvider({
    config: baseConfig,
    transport
  });

  const result = await provider.generatePublishingPackage(createRequest());

  assert.equal(result.article.title, 'Night Zoomies Explained');
  assert.equal(result.summary.text, 'Why cats run at night, explained clearly.');
  assert.equal(result.seo.keywords.includes('night zoomies'), true);
  assert.equal(result.faq[0].question, 'Is this normal?');
  assert.equal(result.metadata?.provider, 'openai');
  assert.equal(result.metadata?.model, 'test-model');
  assert.equal((result.metadata?.usage as { totalTokens?: number }).totalTokens, 170);
  assert.equal(transport.calls.length, 1);
  assert.equal(transport.calls[0].path, '/responses');
});

test('publishing package validation fails when required sections are missing', () => {
  assert.throws(
    () =>
      createPublishingPackage({
        ...createPackageFixture(),
        faq: []
      }),
    PublishingPackageValidationError
  );
});

test('structured output schema validation succeeds', () => {
  const validator = new StructuredOutputValidator();
  const result = validator.validatePublishingPackage(createPackageFixture());

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('structured output schema validation returns descriptive failures', () => {
  const validator = new StructuredOutputValidator();
  const result = validator.validatePublishingPackage({
    ...createPackageFixture(),
    imagePrompt: {
      prompt: ''
    }
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /imagePrompt\.prompt/);
});

test('structured output parser normalizes whitespace and duplicated faq items', () => {
  const parser = new StructuredOutputParser();
  const result = parser.parsePublishingPackage({
    ...createPackageFixture(),
    article: {
      ...createPackageFixture().article,
      title: '  Night   Zoomies   Explained  '
    },
    faq: [
      {
        question: ' Is this normal? ',
        answer: ' Yes. '
      },
      {
        question: 'Is this normal?',
        answer: 'Duplicate should be removed.'
      }
    ]
  });

  assert.equal(result.publishingPackage.article.title, 'Night Zoomies Explained');
  assert.equal(result.publishingPackage.faq.length, 1);
  assert.equal(result.validation.valid, true);
});

test('structured output parser recovers fenced json output', () => {
  const parser = new StructuredOutputParser();
  const result = parser.parsePublishingPackage([
    'Generated package:',
    '```json',
    JSON.stringify(createPackageFixture()),
    '```'
  ].join('\n'));

  assert.equal(result.publishingPackage.article.title, 'Night Zoomies Explained');
  assert.equal(result.validation.valid, true);
});

test('content generation workflow surfaces validation failure', async () => {
  const workflow = new ContentGenerationWorkflow({
    aiProvider: new InvalidPackageProvider(),
    maxRetries: 0
  });

  await assert.rejects(() => workflow.execute(createRequest()), StructuredOutputError);
});

test('content generation workflow retries and then succeeds', async () => {
  const provider = new MockAIProvider({
    publishingPackageResults: [new StructuredOutputError({ code: 'InvalidJson', message: 'Bad JSON.' })]
  });
  const workflow = new ContentGenerationWorkflow({
    aiProvider: provider,
    maxRetries: 1,
    promptVersion: 'v1'
  });

  const result = await workflow.execute(createRequest());

  assert.equal(result.metadata?.retryCount, 1);
  assert.equal(result.metadata?.promptVersion, 'v1');
  assert.equal(result.metadata?.validationResult, 'valid');
});

test('content generation workflow reports retry exhaustion', async () => {
  const workflow = new ContentGenerationWorkflow({
    aiProvider: new MockAIProvider({
      publishingPackageResults: [
        new StructuredOutputError({ code: 'InvalidJson', message: 'Bad JSON.' }),
        new StructuredOutputError({ code: 'InvalidJson', message: 'Still bad JSON.' })
      ]
    }),
    maxRetries: 1
  });

  await assert.rejects(
    () => workflow.execute(createRequest()),
    (error: unknown) => error instanceof StructuredOutputError && error.code === 'InvalidJson'
  );
});

test('content generation workflow recovers from malformed openai JSON', async () => {
  const transport = new SequenceOpenAITransport([
    {
      status: 200,
      body: {
        output_text: 'not-json'
      }
    },
    {
      status: 200,
      body: {
        output_text: JSON.stringify(createPackageFixture())
      }
    }
  ]);
  const provider = new OpenAIProvider({
    config: baseConfig,
    transport
  });
  const workflow = new ContentGenerationWorkflow({
    aiProvider: provider,
    maxRetries: 1
  });

  const result = await workflow.execute(createRequest());

  assert.equal(result.article.title, 'Night Zoomies Explained');
  assert.equal(result.metadata?.retryCount, 1);
  assert.equal(transport.calls.length, 2);
});

test('content generation workflow propagates openai metadata', async () => {
  const transport = new MockOpenAITransport({
    status: 200,
    body: {
      id: 'response-metadata',
      model: 'test-model',
      output_text: JSON.stringify(createPackageFixture()),
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30
      }
    }
  });
  const workflow = new ContentGenerationWorkflow({
    aiProvider: new OpenAIProvider({
      config: baseConfig,
      transport
    })
  });

  const result = await workflow.execute(createRequest());

  assert.equal(result.metadata?.providerName, 'openai');
  assert.equal(result.metadata?.modelName, 'test-model');
  assert.equal((result.metadata?.tokenUsage as { totalTokens?: number }).totalTokens, 30);
  assert.equal(result.metadata?.promptVersion, 'v1');
  assert.equal(typeof result.metadata?.qualityScore, 'number');
  assert.equal(typeof result.metadata?.reviewScore, 'number');
  assert.match(String(result.metadata?.reviewSummary), /Editorial review/);
});

test('content generation workflow propagates prompt version', async () => {
  const workflow = new ContentGenerationWorkflow({
    aiProvider: new MockAIProvider(),
    promptVersion: 'v1'
  });
  const result = await workflow.execute(createRequest());

  assert.equal(result.metadata?.promptVersion, 'v1');
  assert.equal(result.metadata?.promptProfile, 'default');
  assert.equal(result.metadata?.promptId, 'content.article');
  assert.match(String(result.metadata?.renderedPromptPreview), /고양이가 밤에 뛰어다니는 이유/);
  assert.match(String(result.metadata?.composedPromptPreview), /content.system@v1/);
  assert.equal(result.metadata?.retryCount, 0);
  assert.equal(result.metadata?.validationResult, 'valid');
  assert.equal(typeof result.metadata?.qualityScore, 'number');
  assert.equal(typeof result.metadata?.reviewScore, 'number');
  assert.match(String(result.metadata?.reviewSummary), /Editorial review/);
  assert.equal(typeof result.metadata?.realGenerationReview, 'object');
  assert.match(String(result.metadata?.realGenerationThresholdResult), /PASS|WARNING|FAIL/);
  assert.equal(typeof result.metadata?.approvalResult, 'object');
  assert.match(String(result.metadata?.approvalDecision), /APPROVED|NEEDS_REVIEW|REJECTED/);
  assert.equal(typeof result.metadata?.generationDurationMs, 'number');
});

test('content generation workflow supports magazine prompt profile and quality metadata', async () => {
  const workflow = new ContentGenerationWorkflow({
    aiProvider: new MockAIProvider(),
    promptProfile: 'magazine'
  });
  const result = await workflow.execute(createRequest());

  assert.equal(result.metadata?.promptProfile, 'magazine');
  assert.ok((result.metadata?.promptIds as string[]).includes('content.style.magazine'));
  assert.match(String(result.metadata?.composedPromptPreview), /magazine style/);
  assert.equal(typeof result.metadata?.qualityScore, 'number');
  assert.equal((result.metadata?.qualityReport as { valid?: boolean }).valid, true);
  assert.equal(typeof result.metadata?.reviewScore, 'number');
  assert.ok(Array.isArray(result.metadata?.reviewIssues));
  assert.equal(typeof result.metadata?.realGenerationReview, 'object');
  assert.equal(typeof result.metadata?.approvalResult, 'object');
});

test('cat dry-run execution includes publishing package', async () => {
  const result = await runCatMagazineDryRun({
    topic: '고양이가 밤에 뛰어다니는 이유'
  });

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.publishingPackage?.article.title, 'Mock Article: 고양이가 밤에 뛰어다니는 이유');
  assert.equal(result.contentGenerationMetadata?.promptProfile, 'default');
  assert.equal(result.contentGenerationMetadata?.promptId, 'content.article');
  assert.ok(result.contentGenerationMetadata?.promptIds?.includes('content.outputSchema'));
  assert.equal(result.contentGenerationMetadata?.promptVersion, 'v1');
  assert.equal(result.contentGenerationMetadata?.renderedVariables?.topic, '고양이가 밤에 뛰어다니는 이유');
  assert.match(result.contentGenerationMetadata?.composedPromptPreview ?? '', /고양이가 밤에 뛰어다니는 이유/);
  assert.equal(typeof result.contentGenerationMetadata?.qualityScore, 'number');
  assert.equal(typeof result.contentGenerationMetadata?.reviewScore, 'number');
  assert.match(result.contentGenerationMetadata?.reviewSummary ?? '', /Editorial review/);
  assert.ok(Array.isArray(result.contentGenerationMetadata?.reviewIssues));
  assert.equal(typeof result.contentGenerationMetadata?.realGenerationReview, 'object');
  assert.match(result.contentGenerationMetadata?.realGenerationThresholdResult ?? '', /PASS|WARNING|FAIL/);
  assert.equal(typeof result.contentGenerationMetadata?.approvalResult, 'object');
  assert.match(result.contentGenerationMetadata?.approvalDecision ?? '', /APPROVED|NEEDS_REVIEW|REJECTED/);
  assert.equal(result.contentGenerationMetadata?.retryCount, 0);
  assert.equal(result.contentGenerationMetadata?.validationResult, 'valid');
  assert.equal(typeof result.contentGenerationMetadata?.generationDurationMs, 'number');
  assert.ok(result.executedSteps.includes('Generate Publishing Package'));
});

const baseConfig: OpenAIConfig = {
  apiKey: 'test-key',
  model: 'test-model',
  baseUrl: 'https://api.openai.test/v1',
  timeoutMs: 1000,
  productionEnabled: true
};

function createRequest(): ContentRequest {
  return {
    topic: '고양이가 밤에 뛰어다니는 이유',
    language: 'ko-KR',
    audience: 'cat owners',
    tone: 'warm and practical',
    magazineName: 'Cat Magazine',
    createdAt: '2026-07-08T00:00:00.000Z'
  };
}

function createPackageFixture(): PublishingPackage {
  return {
    article: {
      title: 'Night Zoomies Explained',
      summary: 'A practical explanation for nighttime cat activity.',
      body: 'Cats may become active at night because of instincts, routines, and unused energy.',
      slug: 'night-zoomies-explained',
      language: 'ko-KR',
      author: 'Asteria',
      createdAt: '2026-07-08T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: []
      }
    },
    summary: {
      text: 'Why cats run at night, explained clearly.',
      bullets: ['Instinct', 'Routine', 'Energy']
    },
    seo: {
      metaTitle: 'Why Cats Run at Night',
      metaDescription: 'A practical guide to nighttime cat zoomies.',
      keywords: ['night zoomies', 'cat behavior']
    },
    faq: [
      {
        question: 'Is this normal?',
        answer: 'Often yes, but sudden changes should be reviewed carefully.'
      }
    ],
    imagePrompt: {
      prompt: 'A cat running through a quiet living room at night.',
      suggestedTags: ['cat', 'night'],
      mood: 'curious'
    },
    productPrompt: {
      prompt: 'Find enrichment products for active indoor cats.',
      suggestedCategories: ['cat toys'],
      suggestedTags: ['cat', 'enrichment']
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

class SequenceOpenAITransport implements OpenAITransport {
  readonly calls: OpenAITransportRequest[] = [];
  private readonly responses: OpenAITransportResponse[];

  constructor(responses: OpenAITransportResponse[]) {
    this.responses = [...responses];
  }

  async request(_config: OpenAIConfig, request: OpenAITransportRequest): Promise<OpenAITransportResponse> {
    this.calls.push(request);
    return this.responses.shift() ?? this.responses[this.responses.length - 1];
  }
}

class InvalidPackageProvider implements AIProvider {
  readonly name = 'invalid-package-provider';

  async generate(_request: AIRequest): Promise<AIResponse> {
    throw new Error('Not used.');
  }

  async generatePublishingPackage(_request: ContentRequest): Promise<PublishingPackage> {
    return {
      ...createPackageFixture(),
      faq: []
    };
  }

  async *stream(_request: AIRequest): AsyncIterable<AIResponse> {
    throw new Error('Not used.');
  }

  async countTokens(_request: AIRequest): Promise<AIUsage> {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
  }

  async healthCheck(): Promise<AIHealthCheckResult> {
    return {
      ok: true,
      provider: this.name
    };
  }
}
