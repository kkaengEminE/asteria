import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PromptManager, PromptNotFoundError, PromptVariableError } from '../src/prompts/index.ts';

test('prompt manager loads shared prompts', async () => {
  const manager = new PromptManager();

  await manager.load();

  assert.equal(manager.has('article'), true);
  assert.equal(manager.has('seo'), true);
  assert.equal(manager.get('article').source, 'shared');
});

test('magazine prompts override shared prompts', async () => {
  const manager = new PromptManager();

  await manager.load({ magazineSlug: 'cat' });

  const articlePrompt = manager.get('article');

  assert.equal(articlePrompt.source, 'magazine');
  assert.match(articlePrompt.content, /cat care article/);
  assert.equal(manager.get('seo').source, 'shared');
});

test('prompt manager replaces variables', async () => {
  const manager = new PromptManager();

  await manager.load({ magazineSlug: 'cat' });

  const rendered = manager.render('article', {
    magazineName: 'Cat Magazine',
    audience: 'Cat owners',
    tone: 'Warm',
    topic: 'indoor enrichment'
  });

  assert.match(rendered, /Cat Magazine/);
  assert.match(rendered, /Cat owners/);
  assert.match(rendered, /indoor enrichment/);
  assert.doesNotMatch(rendered, /\{\{/);
});

test('missing prompt fails with PromptNotFoundError', async () => {
  const manager = new PromptManager();

  await manager.load();

  assert.throws(() => manager.get('missing'), PromptNotFoundError);
});

test('invalid variables fail validation', async () => {
  const manager = new PromptManager();

  await manager.load();

  assert.throws(
    () =>
      manager.render('article', {
        magazineName: 'Cat Magazine',
        audience: 'Cat owners',
        tone: 'Warm'
      }),
    PromptVariableError
  );
});

