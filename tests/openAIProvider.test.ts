import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AIProviderError,
  MockAIProvider,
  OpenAIProvider,
  createOpenAIConfigFromEnv,
  openAIProviderToken,
  type OpenAIConfig,
  type OpenAITransport,
  type OpenAITransportRequest,
  type OpenAITransportResponse
} from '../src/providers/ai/index.ts';
import { ProviderRegistry } from '../src/providers/index.ts';
import { runCatMagazineDryRun } from '../src/magazines/cat/index.ts';

test('openai provider can be registered', () => {
  const registry = new ProviderRegistry();

  registry.register(openAIProviderToken, () => createProvider());

  assert.equal(registry.has(openAIProviderToken), true);
});

test('openai provider can be resolved', async () => {
  const registry = new ProviderRegistry();

  registry.register(openAIProviderToken, () => createProvider());

  const provider = await registry.resolve(openAIProviderToken, { dryRun: false });
  const health = await provider.healthCheck();

  assert.equal(provider.name, 'openai');
  assert.equal(health.ok, true);
});

test('openai provider maps mocked successful generation', async () => {
  const transport = new MockOpenAITransport({
    status: 200,
    body: {
      id: 'response-1',
      model: 'test-model',
      output_text: 'Generated article body.',
      status: 'completed',
      usage: {
        input_tokens: 12,
        output_tokens: 4,
        total_tokens: 16
      }
    }
  });
  const provider = createProvider(transport);
  const response = await provider.generate({
    systemPrompt: 'You are an editor.',
    userPrompt: 'Write a short article.',
    metadata: {
      dryRun: false
    }
  });

  assert.equal(response.content, 'Generated article body.');
  assert.equal(response.provider, 'openai');
  assert.equal(response.model, 'test-model');
  assert.equal(response.usage.promptTokens, 12);
  assert.equal(response.usage.completionTokens, 4);
  assert.equal(response.metadata?.openAIResponseId, 'response-1');
  assert.equal(transport.calls.length, 1);
  assert.equal(transport.calls[0].path, '/responses');
});

test('openai provider maps mocked api failure', async () => {
  const provider = createProvider(
    new MockOpenAITransport({
      status: 429,
      body: {
        error: {
          message: 'Rate limit reached.'
        }
      }
    })
  );

  await assert.rejects(
    () =>
      provider.generate({
        userPrompt: 'Write something.'
      }),
    (error: unknown) => error instanceof AIProviderError && error.code === 'RateLimit'
  );
});

test('openai provider rejects missing api key', async () => {
  const provider = new OpenAIProvider({
    config: {
      ...baseConfig,
      apiKey: undefined,
      productionEnabled: true
    },
    transport: new MockOpenAITransport(successResponse)
  });

  await assert.rejects(
    () =>
      provider.generate({
        userPrompt: 'Write something.'
      }),
    (error: unknown) => error instanceof AIProviderError && error.code === 'Authentication'
  );
});

test('openai provider does not call transport when production is disabled', async () => {
  const transport = new MockOpenAITransport(successResponse);
  const provider = new OpenAIProvider({
    config: {
      ...baseConfig,
      productionEnabled: false
    },
    transport
  });
  const health = await provider.healthCheck();

  assert.equal(health.ok, false);
  assert.equal(health.metadata?.productionEnabled, false);

  await assert.rejects(
    () =>
      provider.generate({
        userPrompt: 'Write something.'
      }),
    (error: unknown) => error instanceof AIProviderError && error.code === 'ProviderUnavailable'
  );
  assert.equal(transport.calls.length, 0);
});

test('openai provider countTokens is best effort and local', async () => {
  const transport = new MockOpenAITransport(successResponse);
  const provider = createProvider(transport);
  const usage = await provider.countTokens({
    userPrompt: 'one two three'
  });

  assert.equal(usage.promptTokens, 3);
  assert.equal(usage.completionTokens, 0);
  assert.equal(usage.totalTokens, 3);
  assert.equal(transport.calls.length, 0);
});

test('openai config reads environment variables', () => {
  const config = createOpenAIConfigFromEnv({
    OPENAI_API_KEY: 'env-key',
    OPENAI_MODEL: 'env-model',
    OPENAI_BASE_URL: 'https://example.test/v1',
    OPENAI_TIMEOUT_MS: '1234',
    OPENAI_PRODUCTION_ENABLED: 'true',
    OPENAI_ORGANIZATION: 'org',
    OPENAI_PROJECT: 'project'
  });

  assert.equal(config.apiKey, 'env-key');
  assert.equal(config.model, 'env-model');
  assert.equal(config.baseUrl, 'https://example.test/v1');
  assert.equal(config.timeoutMs, 1234);
  assert.equal(config.productionEnabled, true);
  assert.equal(config.organization, 'org');
  assert.equal(config.project, 'project');
});

test('dry-run remains compatible with MockAIProvider default path', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment' });
  const mock = new MockAIProvider();
  const health = await mock.healthCheck();

  assert.equal(result.workflowStatus, 'success');
  assert.match(result.articlePreview ?? '', /Mock Cat Care Article/);
  assert.equal(health.ok, true);
});

const baseConfig: OpenAIConfig = {
  apiKey: 'test-key',
  model: 'test-model',
  baseUrl: 'https://api.openai.test/v1',
  timeoutMs: 1000,
  productionEnabled: true
};

const successResponse: OpenAITransportResponse = {
  status: 200,
  body: {
    id: 'response-success',
    model: 'test-model',
    output_text: 'ok',
    usage: {
      input_tokens: 1,
      output_tokens: 1,
      total_tokens: 2
    }
  }
};

function createProvider(transport: OpenAITransport = new MockOpenAITransport(successResponse)): OpenAIProvider {
  return new OpenAIProvider({
    config: baseConfig,
    transport
  });
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
