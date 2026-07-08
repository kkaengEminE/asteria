import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AIProviderError,
  AIRequestValidationError,
  MockAIProvider,
  countApproximateTokens,
  isRetryableAIError,
  mockAIProviderToken
} from '../src/providers/ai/index.ts';
import { ProviderRegistry } from '../src/providers/index.ts';
import { runCatMagazineDryRun } from '../src/magazines/cat/index.ts';

test('mock ai provider can be registered and resolved', async () => {
  const registry = new ProviderRegistry();

  registry.register(mockAIProviderToken, () => new MockAIProvider());

  const provider = await registry.resolve(mockAIProviderToken, { dryRun: true });
  const health = await provider.healthCheck();

  assert.equal(provider.name, 'mock-ai');
  assert.equal(health.ok, true);
});

test('mock ai provider generation is deterministic', async () => {
  const provider = new MockAIProvider();
  const request = {
    userPrompt: 'Write a cat article about indoor enrichment.',
    temperature: 0.7,
    model: 'mock-model'
  };

  const first = await provider.generate(request);
  const second = await provider.generate(request);

  assert.equal(first.content, second.content);
  assert.equal(first.finishReason, 'stop');
  assert.equal(first.provider, 'mock-ai');
  assert.equal(first.model, 'mock-model');
});

test('mock ai provider returns usage metadata', async () => {
  const provider = new MockAIProvider();
  const response = await provider.generate({
    systemPrompt: 'You are a careful editor.',
    userPrompt: 'Create SEO metadata for Cat Magazine.'
  });

  assert.ok(response.usage.promptTokens > 0);
  assert.ok(response.usage.completionTokens > 0);
  assert.equal(response.usage.totalTokens, response.usage.promptTokens + response.usage.completionTokens);
  assert.equal(response.usage.estimatedCost, 0);
  assert.equal(response.usage.currency, 'USD');
});

test('mock ai provider token counting is deterministic', async () => {
  const provider = new MockAIProvider();
  const usage = await provider.countTokens({
    userPrompt: 'one two three'
  });

  assert.equal(usage.promptTokens, 3);
  assert.equal(usage.completionTokens, 0);
  assert.equal(usage.totalTokens, 3);
  assert.equal(countApproximateTokens('one two three'), 3);
});

test('ai request validation rejects empty prompts', async () => {
  const provider = new MockAIProvider();

  await assert.rejects(
    () =>
      provider.generate({
        userPrompt: ''
      }),
    AIRequestValidationError
  );
});

test('ai error model marks retryable provider errors', () => {
  const error = new AIProviderError('RateLimit', 'Mock rate limit.', {
    provider: 'mock-ai'
  });

  assert.equal(error.code, 'RateLimit');
  assert.equal(error.provider, 'mock-ai');
  assert.equal(error.retryable, true);
  assert.equal(isRetryableAIError('Authentication'), false);
});

test('cat dry run uses mock ai provider through workflow integration', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment' });

  assert.equal(result.workflowStatus, 'success');
  assert.match(result.articlePreview ?? '', /Mock Cat Care Article/);
  assert.match(result.seoPreview ?? '', /Title Tag/);
});
