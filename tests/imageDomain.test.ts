import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createImageAsset,
  createImageMetadata,
  ImageMetadataValidationError,
  matchesImageSearchQuery,
  scoreImageAsset,
  selectHighestScoredImage
} from '../src/domain/image/index.ts';
import type { ImageAsset } from '../src/domain/image/index.ts';

test('image metadata validation normalizes tags and infers orientation', () => {
  const metadata = createImageMetadata({
    filename: 'cat-window.jpg',
    title: 'Cat by the window',
    tags: ['Cat', ' Indoor ', 'cat'],
    category: 'article',
    width: 1600,
    height: 900,
    rating: 4,
    favorite: true
  });

  assert.deepEqual(metadata.tags, ['cat', 'indoor']);
  assert.equal(metadata.orientation, 'landscape');
});

test('image metadata validation rejects invalid rating', () => {
  assert.throws(
    () =>
      createImageMetadata({
        filename: 'bad-rating.jpg',
        rating: 7
      }),
    ImageMetadataValidationError
  );
});

test('image search query filters by tags and rating', () => {
  const asset = createAsset('cat-1', {
    tags: ['cat', 'indoor', 'play'],
    rating: 5
  });

  assert.equal(
    matchesImageSearchQuery(asset, {
      criteria: {
        tags: ['cat', 'indoor'],
        minimumRating: 4
      }
    }),
    true
  );
  assert.equal(
    matchesImageSearchQuery(asset, {
      criteria: {
        tags: ['dog'],
        minimumRating: 4
      }
    }),
    false
  );
});

test('image selection scoring prefers stronger matching asset', () => {
  const catHero = createAsset('cat-hero', {
    title: 'Playful indoor cat',
    tags: ['cat', 'indoor', 'play'],
    category: 'hero',
    rating: 5,
    favorite: true,
    width: 1600,
    height: 900
  });
  const genericCat = createAsset('cat-generic', {
    title: 'Cat portrait',
    tags: ['cat'],
    category: 'article',
    rating: 3,
    width: 800,
    height: 1200
  });

  const score = scoreImageAsset(catHero, {
    topic: 'indoor cat',
    tags: ['cat', 'indoor'],
    category: 'hero',
    aspectRatio: 'landscape',
    minimumRating: 4
  });
  const selected = selectHighestScoredImage([genericCat, catHero], {
    topic: 'indoor cat',
    tags: ['cat', 'indoor'],
    category: 'hero',
    aspectRatio: 'landscape',
    minimumRating: 4
  });

  assert.equal(score.assetId, 'cat-hero');
  assert.ok(score.score > 0);
  assert.equal(selected?.id, 'cat-hero');
});

test('image search query matches text fields', () => {
  const asset = createAsset('cat-window', {
    filename: 'window-cat.jpg',
    description: 'A calm cat resting near bright morning light.',
    tags: ['cat', 'calm']
  });

  assert.equal(
    matchesImageSearchQuery(asset, {
      text: 'morning light'
    }),
    true
  );
  assert.equal(
    matchesImageSearchQuery(asset, {
      text: 'night city'
    }),
    false
  );
});

function createAsset(
  id: string,
  overrides: Partial<Parameters<typeof createImageMetadata>[0]> = {}
): ImageAsset {
  return createImageAsset({
    id,
    uri: `asset://${id}`,
    metadata: createImageMetadata({
      filename: `${id}.jpg`,
      tags: [],
      ...overrides
    })
  });
}

