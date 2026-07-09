import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AIProviderError,
  GeminiProvider,
  createGeminiConfigFromEnv,
  geminiProviderToken,
  type GeminiConfig,
  type GeminiTransport,
  type GeminiTransportRequest,
  type GeminiTransportResponse
} from '../src/providers/ai/index.ts';
import { ProviderRegistry } from '../src/providers/index.ts';
import { runCatMagazineDryRun } from '../src/magazines/cat/index.ts';

test('gemini provider is disabled by default', async () => {
  const transport = new MockGeminiTransport(successResponse);
  const provider = new GeminiProvider({
    config: {
      ...baseConfig,
      productionEnabled: false
    },
    transport
  });
  const health = await provider.healthCheck();

  assert.equal(health.ok, false);
  assert.equal(health.message, 'Gemini production mode is disabled. Set GEMINI_PRODUCTION_ENABLED=true.');

  await assert.rejects(
    () =>
      provider.generate({
        userPrompt: 'Write something.'
      }),
    (error: unknown) => error instanceof AIProviderError && error.code === 'ProviderUnavailable'
  );
  assert.equal(transport.calls.length, 0);
});

test('gemini provider rejects missing api key', async () => {
  const provider = new GeminiProvider({
    config: {
      ...baseConfig,
      apiKey: undefined,
      productionEnabled: true
    },
    transport: new MockGeminiTransport(successResponse)
  });

  await assert.rejects(
    () =>
      provider.generate({
        userPrompt: 'Write something.'
      }),
    (error: unknown) => error instanceof AIProviderError && error.code === 'Authentication'
  );
});

test('gemini provider maps request shape', async () => {
  const transport = new MockGeminiTransport(successResponse);
  const provider = createProvider(transport);
  const response = await provider.generate({
    systemPrompt: 'You are an editor.',
    userPrompt: 'Write a concise answer.',
    temperature: 0.2,
    maxTokens: 123
  });
  const request = transport.calls[0];
  const body = request.body as {
    systemInstruction?: { parts: Array<{ text: string }> };
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig?: { temperature?: number; maxOutputTokens?: number; responseMimeType?: string };
  };

  assert.equal(response.provider, 'gemini');
  assert.equal(request.path, '/models/test-gemini:generateContent');
  assert.equal(body.systemInstruction?.parts[0].text, 'You are an editor.');
  assert.equal(body.contents[0].role, 'user');
  assert.equal(body.contents[0].parts[0].text, 'Write a concise answer.');
  assert.equal(body.generationConfig?.temperature, 0.2);
  assert.equal(body.generationConfig?.maxOutputTokens, 123);
  assert.equal(body.generationConfig?.responseMimeType, undefined);
});

test('gemini provider maps response into publishing package', async () => {
  const transport = new MockGeminiTransport({
    status: 200,
    body: {
      candidates: [
        {
          content: {
            parts: [
              {
                text: ['```json', JSON.stringify(createPublishingPackageFixture()), '```'].join('\n')
              }
            ]
          },
          finishReason: 'STOP'
        }
      ],
      modelVersion: 'test-gemini',
      usageMetadata: {
        promptTokenCount: 20,
        candidatesTokenCount: 30,
        totalTokenCount: 50
      }
    }
  });
  const provider = createProvider(transport);
  const result = await provider.generatePublishingPackage({
    topic: '고양이가 밤에 뛰어다니는 이유',
    language: 'ko-KR',
    createdAt: '2026-07-08T00:00:00.000Z',
    metadata: {
      renderedPrompt: 'Gemini rendered prompt for cat night activity.',
      promptId: 'content.article',
      promptVersion: 'v1'
    }
  });
  const requestBody = transport.calls[0].body as {
    contents: Array<{ parts: Array<{ text: string }> }>;
    generationConfig?: { maxOutputTokens?: number; responseMimeType?: string };
    systemInstruction?: { parts: Array<{ text: string }> };
  };

  assert.equal(result.article.title, '고양이가 밤에 뛰어다니는 이유');
  assert.match(result.article.body, /night zoomies/);
  assert.equal(result.summary.text, '고양이의 야간 활동 이유를 설명합니다.');
  assert.equal(result.seo.metaTitle, '고양이가 밤에 뛰어다니는 이유');
  assert.equal(result.metadata?.provider, 'gemini');
  assert.equal(result.metadata?.model, 'test-gemini');
  assert.equal((result.metadata?.usage as { totalTokens?: number }).totalTokens, 50);
  assert.match(requestBody.contents[0].parts[0].text, /Gemini rendered prompt/);
  assert.match(requestBody.contents[0].parts[0].text, /Escape all newlines/);
  assert.match(requestBody.systemInstruction?.parts[0].text ?? '', /Return complete JSON only/);
  assert.equal(requestBody.generationConfig?.maxOutputTokens, 4000);
  assert.equal(requestBody.generationConfig?.responseMimeType, 'application/json');
});

test('gemini provider recovers common malformed JSON strings', async () => {
  const provider = createProvider(
    new MockGeminiTransport({
      status: 200,
      body: {
        candidates: [
          {
            content: {
              parts: [{ text: createRepairableGeminiJson() }]
            }
          }
        ],
        modelVersion: 'test-gemini'
      }
    })
  );

  const result = await provider.generatePublishingPackage({
    topic: '고양이가 밤에 뛰어다니는 이유',
    language: 'ko-KR'
  });

  assert.match(result.article.body, /첫 번째 줄\n두 번째 줄/);
  assert.match(result.article.body, /"우다다"/);
  assert.equal(result.metadata?.note, '마지막 문자열');
});

test('gemini provider reports malformed response with preview clearly', async () => {
  const provider = createProvider(
    new MockGeminiTransport({
      status: 200,
      body: {
        candidates: [
          {
            content: {
              parts: [{ text: '{"article": }' }]
            }
          }
        ]
      }
    })
  );

  await assert.rejects(
    () =>
      provider.generatePublishingPackage({
        topic: 'malformed gemini response'
      }),
    (error: unknown) =>
      error instanceof AIProviderError &&
      error.code === 'InvalidRequest' &&
      /Provider: gemini/.test(error.message) &&
      /Model: test-gemini/.test(error.message) &&
      /Parse error:/.test(error.message) &&
      /Raw response preview:/.test(error.message)
  );
});

test('gemini provider can be registered and resolved', async () => {
  const registry = new ProviderRegistry();

  registry.register(geminiProviderToken, () => createProvider());

  const provider = await registry.resolve(geminiProviderToken, { dryRun: false });
  const health = await provider.healthCheck();

  assert.equal(provider.name, 'gemini');
  assert.equal(health.ok, true);
});

test('gemini config reads environment variables', () => {
  const config = createGeminiConfigFromEnv({
    GEMINI_API_KEY: 'env-key',
    GEMINI_MODEL: 'env-model',
    GEMINI_BASE_URL: 'https://gemini.example.test/v1',
    GEMINI_TIMEOUT_MS: '1234',
    GEMINI_PRODUCTION_ENABLED: 'true'
  });

  assert.equal(config.apiKey, 'env-key');
  assert.equal(config.model, 'env-model');
  assert.equal(config.baseUrl, 'https://gemini.example.test/v1');
  assert.equal(config.timeoutMs, 1234);
  assert.equal(config.productionEnabled, true);
});

test('cat dry run selects gemini mode when requested', async () => {
  const transport = new MockGeminiTransport({
    status: 200,
    body: {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify(createPublishingPackageFixture())
              }
            ]
          },
          finishReason: 'STOP'
        }
      ],
      modelVersion: 'test-gemini',
      usageMetadata: {
        promptTokenCount: 12,
        candidatesTokenCount: 18,
        totalTokenCount: 30
      }
    }
  });
  const result = await runCatMagazineDryRun({
    topic: '고양이가 밤에 뛰어다니는 이유',
    aiMode: 'gemini',
    geminiEnv: {
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'test-gemini',
      GEMINI_PRODUCTION_ENABLED: 'true'
    },
    geminiTransport: transport
  });

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.contentGenerationMetadata?.providerName, 'gemini');
  assert.equal(result.contentGenerationMetadata?.modelName, 'test-gemini');
  assert.equal(transport.calls.length, 3);
});

test('cat dry run propagates ko-KR language into prompt and package metadata', async () => {
  const result = await runCatMagazineDryRun({
    topic: '고양이가 밤에 뛰어다니는 이유',
    language: 'ko-KR'
  });

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.contentGenerationMetadata?.language, 'ko-KR');
  assert.equal(result.publishingPackage?.metadata?.language, 'ko-KR');
  assert.equal(result.publishingPackage?.article.language, 'ko-KR');
  assert.equal(result.contentGenerationMetadata?.renderedVariables?.language, 'ko-KR');
  assert.match(result.contentGenerationMetadata?.composedPromptPreview ?? '', /Language:\nko-KR/);
});

const baseConfig: GeminiConfig = {
  apiKey: 'test-key',
  model: 'test-gemini',
  baseUrl: 'https://generativelanguage.googleapis.test/v1beta',
  timeoutMs: 1000,
  productionEnabled: true
};

const successResponse: GeminiTransportResponse = {
  status: 200,
  body: {
    candidates: [
      {
        content: {
          parts: [{ text: 'Gemini generated text.' }]
        },
        finishReason: 'STOP'
      }
    ],
    modelVersion: 'test-gemini',
    usageMetadata: {
      promptTokenCount: 3,
      candidatesTokenCount: 4,
      totalTokenCount: 7
    }
  }
};

class MockGeminiTransport implements GeminiTransport {
  readonly calls: GeminiTransportRequest[] = [];
  private readonly response: GeminiTransportResponse;

  constructor(response: GeminiTransportResponse = successResponse) {
    this.response = response;
  }

  async request(_config: GeminiConfig, request: GeminiTransportRequest): Promise<GeminiTransportResponse> {
    this.calls.push(request);
    return this.response;
  }
}

function createProvider(transport = new MockGeminiTransport()): GeminiProvider {
  return new GeminiProvider({
    config: baseConfig,
    transport
  });
}

function createPublishingPackageFixture() {
  return {
    article: {
      title: '고양이가 밤에 뛰어다니는 이유',
      subtitle: '야간 활동을 이해하는 짧은 안내',
      summary: '고양이의 야간 활동 이유를 설명합니다.',
      body: 'Cat night zoomies often come from natural hunting rhythms, stored energy, and evening attention patterns. A predictable play routine before bedtime can help indoor cats settle more calmly.',
      slug: 'cat-night-zoomies',
      language: 'ko-KR',
      author: 'Asteria',
      createdAt: '2026-07-08T00:00:00.000Z'
    },
    summary: {
      text: '고양이의 야간 활동 이유를 설명합니다.',
      bullets: ['본능적 활동 시간', '낮 동안 남은 에너지']
    },
    seo: {
      metaTitle: '고양이가 밤에 뛰어다니는 이유',
      metaDescription: '고양이 야간 우다다의 원인과 완화 방법을 설명합니다.',
      keywords: ['고양이', '우다다', '야간 활동']
    },
    faq: [
      {
        question: '밤에 뛰는 행동은 정상인가요?',
        answer: '대부분은 정상적인 에너지 발산이지만 갑작스러운 변화는 관찰이 필요합니다.'
      }
    ],
    imagePrompt: {
      prompt: 'Indoor cat playing at night near a window.',
      suggestedTags: ['cat', 'night', 'play'],
      mood: 'calm'
    },
    productPrompt: {
      prompt: 'Safe evening play products for indoor cats.',
      suggestedCategories: ['cat-care'],
      suggestedTags: ['toy', 'enrichment']
    }
  };
}

function createRepairableGeminiJson(): string {
  return [
    '{',
    '  "article": {',
    '    "title": "고양이가 밤에 뛰어다니는 이유",',
    '    "summary": "야간 활동 설명",',
    '    "body": "첫 번째 줄',
    '두 번째 줄에는 "우다다"라는 표현이 포함됩니다.",',
    '    "slug": "cat-night-zoomies",',
    '    "language": "ko-KR",',
    '    "createdAt": "2026-07-08T00:00:00.000Z"',
    '  },',
    '  "summary": {"text": "고양이 야간 활동 요약입니다."},',
    '  "seo": {"metaTitle": "고양이가 밤에 뛰어다니는 이유", "metaDescription": "고양이 야간 활동 설명", "keywords": ["고양이", "우다다"]},',
    '  "faq": [{"question": "밤에 뛰는 행동은 정상인가요?", "answer": "대부분은 정상적인 에너지 발산입니다."}],',
    '  "imagePrompt": {"prompt": "밤에 노는 고양이"},',
    '  "productPrompt": {"prompt": "고양이 장난감 추천"},',
    '  "metadata": {"note": "마지막 문자열'
  ].join('\n');
}
