import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MagazineTemplateRegistry,
  loadMagazineTemplate,
  validateMagazineTemplate
} from '../src/domain/magazineTemplate/index.ts';
import { loadMagazineProfile } from '../src/domain/magazineProfile/index.ts';

test('magazine template loads from configuration file', async () => {
  const template = await loadMagazineTemplate('blog');

  assert.equal(template.id, 'blog');
  assert.equal(template.promptProfile, 'blog');
  assert.equal(template.reviewPolicy.minimumArticleWords, 80);
});

test('magazine template registry resolves loaded template', async () => {
  const registry = new MagazineTemplateRegistry();
  const template = await registry.loadTemplate('blog');

  assert.deepEqual(registry.resolve('blog'), template);
  assert.equal(registry.has('blog'), true);
  assert.deepEqual(registry.list().map((item) => item.id), ['blog']);
});

test('magazine template validation rejects missing required fields', () => {
  assert.throws(
    () => validateMagazineTemplate({ id: 'broken' }),
    /Missing or invalid required field: persona/
  );
});

test('magazine profile inherits template values', async () => {
  const profile = await loadMagazineProfile('cat');

  assert.equal(profile.template, 'blog');
  assert.equal(profile.reviewPolicy?.minimumQualityScore, 80);
  assert.equal(profile.reviewPolicy?.minimumReviewScore, 80);
  assert.equal(profile.reviewPolicy?.minimumArticleWords, 80);
  assert.equal(profile.imageStyle.preferredOrientation, 'landscape');
  assert.equal(profile.affiliatePolicy.disclosure, 'Affiliate disclosure placeholder. Mock affiliate links are shown for dry-run review only.');
});

test('magazine profile overrides template values', async () => {
  const profile = await loadMagazineProfile('cat');

  assert.equal(profile.promptProfile, 'magazine');
  assert.equal(profile.style, 'magazine');
  assert.equal(profile.tone, 'Warm, trustworthy, practical, and lightly playful.');
  assert.equal(profile.affiliatePolicy.enabled, true);
  assert.deepEqual(profile.affiliatePolicy.preferredCategories, ['cat-care', 'cat-enrichment', 'cat-health']);
  assert.equal(profile.imageStyle.description, 'Bright editorial cat photography with practical home-care context.');
});
