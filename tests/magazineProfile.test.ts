import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import {
  MagazineProfileRegistry,
  loadMagazineProfile,
  validateMagazineProfile
} from '../src/domain/magazineProfile/index.ts';
import { runCatMagazineDryRun } from '../src/magazines/cat/index.ts';

test('magazine profile loads from configuration file', async () => {
  const profile = await loadMagazineProfile('cat');

  assert.equal(profile.id, 'cat');
  assert.equal(profile.template, 'blog');
  assert.equal(profile.name, 'Cat Magazine');
  assert.equal(profile.style, 'magazine');
  assert.equal(profile.promptProfile, 'magazine');
  assert.equal(profile.affiliatePolicy.enabled, true);
});

test('dog profile loads and inherits blog template', async () => {
  const profile = await loadMagazineProfile('dog');

  assert.equal(profile.id, 'dog');
  assert.equal(profile.template, 'blog');
  assert.equal(profile.name, 'Dog Magazine');
  assert.equal(profile.promptProfile, 'magazine');
  assert.equal(profile.reviewPolicy?.minimumArticleWords, 80);
  assert.equal(profile.imageStyle.preferredOrientation, 'landscape');
  assert.equal(profile.affiliatePolicy.enabled, true);
});

test('magazine profile registry resolves loaded profile', async () => {
  const registry = new MagazineProfileRegistry();
  const profile = await registry.loadProfile('cat');

  assert.deepEqual(registry.resolve('cat'), profile);
  assert.equal(registry.has('cat'), true);
  assert.deepEqual(registry.list().map((item) => item.id), ['cat']);
});

test('magazine profile validation rejects missing required fields', () => {
  assert.throws(
    () => validateMagazineProfile({ id: 'broken' }),
    /Missing or invalid required field: name/
  );
});

test('cat dry run propagates magazine profile into prompt composition', async () => {
  const result = await runCatMagazineDryRun({
    topic: 'indoor enrichment',
    magazineSlug: 'cat',
    language: 'ko-KR'
  });

  assert.equal(result.magazine?.slug, 'cat');
  assert.equal(result.magazine?.name, 'Cat Magazine');
  assert.equal(result.contentGenerationMetadata?.promptProfile, 'magazine');
  assert.equal(result.contentGenerationMetadata?.renderedVariables?.magazineName, 'Cat Magazine');
  assert.equal(
    result.contentGenerationMetadata?.renderedVariables?.audience,
    'Cat owners, cat lovers, and people researching practical feline care.'
  );
  assert.equal(result.contentGenerationMetadata?.renderedVariables?.tone, 'Warm, trustworthy, practical, and lightly playful.');
});

test('cat dry run remains backward compatible without magazine option', async () => {
  const result = await runCatMagazineDryRun({ topic: 'indoor enrichment' });

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.magazine?.slug, 'cat');
});

test('dog dry run propagates dog magazine profile into prompt composition', async () => {
  const result = await runCatMagazineDryRun({
    topic: '강아지가 산책 중 냄새를 오래 맡는 이유',
    magazineSlug: 'dog',
    language: 'ko-KR'
  });

  assert.equal(result.workflowStatus, 'success');
  assert.equal(result.magazine?.slug, 'dog');
  assert.equal(result.magazine?.name, 'Dog Magazine');
  assert.equal(result.contentGenerationMetadata?.promptProfile, 'magazine');
  assert.equal(result.contentGenerationMetadata?.renderedVariables?.magazineName, 'Dog Magazine');
  assert.equal(
    result.contentGenerationMetadata?.renderedVariables?.audience,
    'Dog guardians, puppy parents, and people researching practical canine care.'
  );
  assert.equal(result.selectedImage?.filename, 'dog-walk-sniffing.jpg');
  assert.ok(result.recommendedProducts?.some((product) => product.id.startsWith('dog-')));
});

test('missing magazine handling fails gracefully', async () => {
  const result = await runCatMagazineDryRun({
    magazineSlug: 'missing',
    topic: 'unknown magazine'
  });

  assert.equal(result.workflowStatus, 'failed');
  assert.match(result.error ?? '', /Magazine config not found for slug: missing/);
});

test('missing magazine profile fails gracefully', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asteria-profile-missing-'));
  await mkdir(join(dir, 'magazines', 'cat'), { recursive: true });
  await writeFile(join(dir, 'magazines', 'cat', 'config.example.json'), JSON.stringify(createMinimalCatConfig()), 'utf8');

  const result = await runCatMagazineDryRun({
    rootDir: dir,
    magazineSlug: 'cat',
    topic: 'indoor enrichment'
  });

  assert.equal(result.workflowStatus, 'failed');
  assert.match(result.error ?? '', /Magazine profile not found: cat/);
});

function createMinimalCatConfig(): Record<string, unknown> {
  return {
    name: 'Cat Magazine',
    slug: 'cat',
    language: 'en-US',
    audience: 'Cat readers',
    tone: 'Warm',
    topics: ['cats'],
    imageSource: 'mock',
    publishingDestinations: [
      {
        type: 'preview',
        name: 'Preview',
        enabled: false,
        dryRunOnly: true
      }
    ],
    schedule: {
      timezone: 'Asia/Seoul',
      cadence: 'daily'
    },
    promptSet: 'cat'
  };
}
