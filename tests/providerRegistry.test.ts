import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AIProvider, AIProviderRequest, AIProviderResponse } from '../src/core/index.ts';
import {
  createProviderToken,
  DuplicateProviderRegistrationError,
  ProviderNotFoundError,
  ProviderRegistry
} from '../src/providers/index.ts';

const mockAiToken = createProviderToken<AIProvider>('AI', 'mock-ai', 'Mock AI provider for tests.');
const alternateMockAiToken = createProviderToken<AIProvider>('AI', 'alternate-mock-ai');

test('provider registry registers provider', () => {
  const registry = new ProviderRegistry();

  registry.register(mockAiToken, () => createMockAiProvider('mock-ai'));

  assert.equal(registry.has(mockAiToken), true);
  assert.deepEqual(registry.list(), [
    {
      category: 'AI',
      name: 'mock-ai',
      description: 'Mock AI provider for tests.'
    }
  ]);
});

test('provider registry resolves provider', async () => {
  const registry = new ProviderRegistry();

  registry.register(mockAiToken, {
    create: (context) => createMockAiProvider(context.magazineSlug ?? 'mock-ai')
  });

  const provider = await registry.resolve(mockAiToken, {
    magazineSlug: 'cat',
    dryRun: true
  });

  const response = await provider.generate({ prompt: 'Hello' });

  assert.equal(provider.name, 'cat');
  assert.equal(response.text, 'mock response: Hello');
});

test('provider registry rejects duplicate registration', () => {
  const registry = new ProviderRegistry();

  registry.register(mockAiToken, () => createMockAiProvider('mock-ai'));

  assert.throws(
    () => registry.register(mockAiToken, () => createMockAiProvider('duplicate')),
    DuplicateProviderRegistrationError
  );
});

test('provider registry fails for unknown provider', async () => {
  const registry = new ProviderRegistry();

  await assert.rejects(
    () =>
      registry.resolve(mockAiToken, {
        dryRun: true
      }),
    ProviderNotFoundError
  );
});

test('provider registry removes provider', async () => {
  const registry = new ProviderRegistry();

  registry.register(mockAiToken, () => createMockAiProvider('mock-ai'));
  registry.register(alternateMockAiToken, () => createMockAiProvider('alternate-mock-ai'));

  assert.equal(registry.remove(mockAiToken), true);
  assert.equal(registry.has(mockAiToken), false);
  assert.equal(registry.has(alternateMockAiToken), true);
  assert.deepEqual(registry.list('AI'), [
    {
      category: 'AI',
      name: 'alternate-mock-ai',
      description: undefined
    }
  ]);

  await assert.rejects(
    () =>
      registry.resolve(mockAiToken, {
        dryRun: true
      }),
    ProviderNotFoundError
  );
});

function createMockAiProvider(name: string): AIProvider {
  return {
    name,
    async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
      return {
        text: `mock response: ${request.prompt}`
      };
    }
  };
}

