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
    'Select Image',
    'Generate Article',
    'Generate SEO',
    'Generate Monetization Preview',
    'Publish Preview'
  ]);
  assert.match(result.renderedPromptPreview ?? '', /indoor enrichment/);
  assert.match(result.articlePreview ?? '', /Mock Cat Care Article/);
  assert.match(result.seoPreview ?? '', /Title Tag/);
  assert.equal(result.publishPreview?.status, 'draft');
  assert.equal(result.selectedImage?.filename, 'cat-window-enrichment.jpg');
  assert.match(result.imagePreview ?? '', /^mock:\/\//);
  assert.match(result.monetizationPreview ?? '', /Interactive Cat Enrichment Toy/);
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
  assert.deepEqual(result.executedSteps, ['Load Config', 'Load Prompt', 'Research', 'Select Image', 'Generate Article']);
  assert.match(result.error ?? '', /Generate Article/);
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

function createFailingAIProvider(): AIProvider {
  return {
    name: 'failing-ai',
    async generate(_request: AIProviderRequest): Promise<AIProviderResponse> {
      throw new Error('Mock AI failure.');
    }
  };
}
