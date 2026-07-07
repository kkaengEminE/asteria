import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import type { AIProvider, AIProviderRequest, AIProviderResponse } from '../src/core/index.ts';
import { ProviderRegistry } from '../src/providers/index.ts';
import {
  registerCatDryRunMockProviders,
  runCatMagazineDryRun
} from '../src/magazines/cat/index.ts';
import { mockAiProviderToken } from '../src/magazines/cat/providerTokens.ts';

test('cat magazine dry run succeeds', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment' });

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.magazine?.slug, 'cat');
  assert.deepEqual(result.executedSteps, [
    'Load Config',
    'Load Prompt',
    'Research',
    'Generate Article',
    'Generate SEO',
    'Publish Preview'
  ]);
  assert.match(result.renderedPromptPreview ?? '', /indoor enrichment/);
  assert.match(result.articlePreview ?? '', /Mock Cat Care Article/);
  assert.match(result.seoPreview ?? '', /Title Tag/);
  assert.equal(result.publishPreview?.status, 'draft');
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
  assert.deepEqual(result.executedSteps, ['Load Config', 'Load Prompt', 'Research', 'Generate Article']);
  assert.match(result.error ?? '', /Generate Article/);
});

function createFailingAIProvider(): AIProvider {
  return {
    name: 'failing-ai',
    async generate(_request: AIProviderRequest): Promise<AIProviderResponse> {
      throw new Error('Mock AI failure.');
    }
  };
}
