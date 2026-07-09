import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PromptAssetNotFoundError,
  PromptAssetRegistry,
  PromptVariableError,
  composePrompt,
  createDefaultPromptAssetRegistry
} from '../src/prompts/index.ts';

test('prompt asset registry registers prompt assets', () => {
  const registry = new PromptAssetRegistry();

  registry.register({
    id: 'content.article',
    version: 'v1',
    template: 'Topic: {{topic}}'
  });

  assert.equal(registry.list().length, 1);
  assert.equal(registry.metadata('content.article').id, 'content.article');
});

test('prompt asset registry resolves latest version', () => {
  const registry = new PromptAssetRegistry();

  registry.register({
    id: 'content.article',
    version: 'v1',
    template: 'v1 {{topic}}'
  });
  registry.register({
    id: 'content.article',
    version: 'v2',
    template: 'v2 {{topic}}'
  });

  const prompt = registry.resolveLatest('content.article');
  const rendered = prompt.render({ topic: 'cats' });

  assert.equal(prompt.metadata.version, 'v2');
  assert.equal(rendered.rendered, 'v2 cats');
});

test('prompt asset registry resolves explicit version', () => {
  const registry = new PromptAssetRegistry();

  registry.register({
    id: 'content.article',
    version: 'v1',
    template: 'v1 {{topic}}'
  });
  registry.register({
    id: 'content.article',
    version: 'v2',
    template: 'v2 {{topic}}'
  });

  const rendered = registry.resolve('content.article', 'v1').render({ topic: 'cats' });

  assert.equal(rendered.version, 'v1');
  assert.equal(rendered.rendered, 'v1 cats');
});

test('prompt asset registry renders templates with variables', () => {
  const registry = new PromptAssetRegistry();

  registry.register({
    id: 'content.summary',
    version: 'v1',
    template: 'Topic: {{topic}}\nLanguage: {{language}}'
  });

  const rendered = registry.resolve('content.summary', 'v1').render({
    topic: 'night zoomies',
    language: 'ko-KR'
  });

  assert.match(rendered.rendered, /night zoomies/);
  assert.match(rendered.rendered, /ko-KR/);
  assert.deepEqual(rendered.metadata.variables, ['language', 'topic']);
});

test('prompt asset registry rejects missing variables', () => {
  const registry = new PromptAssetRegistry();

  registry.register({
    id: 'content.faq',
    version: 'v1',
    template: 'Topic: {{topic}}\nAudience: {{audience}}'
  });

  assert.throws(() => registry.resolve('content.faq', 'v1').render({ topic: 'cats' }), PromptVariableError);
});

test('prompt asset registry throws when prompt is missing', () => {
  const registry = new PromptAssetRegistry();

  assert.throws(() => registry.resolve('missing.prompt'), PromptAssetNotFoundError);
});

test('default prompt asset registry loads content prompt assets', async () => {
  const registry = await createDefaultPromptAssetRegistry();
  const rendered = registry.resolve('content.article', 'v1').render({
    topic: '고양이가 밤에 뛰어다니는 이유',
    language: 'ko-KR',
    audience: 'cat owners',
    tone: 'warm',
    magazineName: 'Cat Magazine'
  });

  assert.equal(registry.list().length >= 6, true);
  assert.match(rendered.rendered, /고양이가 밤에 뛰어다니는 이유/);
  assert.equal(rendered.id, 'content.article');
  assert.equal(rendered.version, 'v1');
});

test('prompt composition uses the default profile stack', async () => {
  const registry = await createDefaultPromptAssetRegistry();
  const composed = composePrompt({
    registry,
    profile: 'default',
    version: 'v1',
    variables: {
      topic: 'indoor enrichment',
      language: 'en-US',
      audience: 'cat owners',
      tone: 'warm',
      magazineName: 'Cat Magazine'
    }
  });

  assert.equal(composed.profile, 'default');
  assert.deepEqual(composed.promptIds, [
    'content.system',
    'content.persona',
    'content.style.default',
    'content.task',
    'content.outputSchema'
  ]);
  assert.match(composed.rendered, /provider-neutral AI publishing assistant/);
  assert.match(composed.rendered, /indoor enrichment/);
});

test('prompt composition resolves magazine profile', async () => {
  const registry = await createDefaultPromptAssetRegistry();
  const composed = composePrompt({
    registry,
    profile: 'magazine',
    version: 'v1',
    variables: {
      topic: 'night zoomies',
      language: 'en-US',
      audience: 'cat owners',
      tone: 'polished',
      magazineName: 'Cat Magazine'
    }
  });

  assert.equal(composed.profile, 'magazine');
  assert.ok(composed.promptIds.includes('content.style.magazine'));
  assert.match(composed.rendered, /polished magazine style/);
});
