import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadMagazineConfig, MagazineConfigLoadError, validateMagazineConfig } from '../src/config/index.ts';
import { MagazineConfigValidationError } from '../src/config/index.ts';

test('valid cat config loads successfully', async () => {
  const config = await loadMagazineConfig('cat');

  assert.equal(config.name, 'Cat Magazine');
  assert.equal(config.slug, 'cat');
  assert.equal(config.language, 'en-US');
  assert.ok(config.topics.includes('cat health'));
  assert.equal(config.schedule.timezone, 'Asia/Seoul');
});

test('missing required field fails validation', () => {
  const invalidConfig = {
    slug: 'cat',
    language: 'en-US',
    audience: 'Cat owners',
    tone: 'Warm',
    topics: ['cat health'],
    imageSource: 'google-drive-curated-library',
    publishingDestinations: [
      {
        type: 'wordpress',
        name: 'Cat Magazine WordPress',
        enabled: false
      }
    ],
    schedule: {
      timezone: 'Asia/Seoul',
      cadence: 'daily'
    },
    promptSet: 'cat-magazine-default'
  };

  assert.throws(() => validateMagazineConfig(invalidConfig), MagazineConfigValidationError);
});

test('invalid path fails gracefully', async () => {
  await assert.rejects(() => loadMagazineConfig('missing-magazine'), MagazineConfigLoadError);
});

