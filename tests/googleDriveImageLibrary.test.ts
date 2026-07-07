import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProviderRegistry } from '../src/providers/index.ts';
import {
  GoogleDriveImageLibrary,
  googleDriveImageLibraryToken,
  mapGoogleDriveRecordToImageAsset
} from '../src/providers/image/googleDrive/index.ts';
import type { GoogleDriveImageRecord } from '../src/providers/image/googleDrive/index.ts';

test('maps Google Drive records to ImageAsset', () => {
  const asset = mapGoogleDriveRecordToImageAsset(mockRecords[0]);

  assert.equal(asset.id, 'cat-window');
  assert.equal(asset.uri, 'mock://drive/cat-window.jpg');
  assert.equal(asset.metadata.filename, 'cat-window.jpg');
  assert.equal(asset.metadata.orientation, 'landscape');
  assert.equal(asset.metadata.source?.provider, 'google-drive');
  assert.equal(asset.metadata.source?.externalId, 'drive-file-cat-window');
});

test('google drive image library searches by tag', async () => {
  const library = createLibrary();
  const results = await library.search({
    criteria: {
      tags: ['cat', 'indoor']
    }
  });

  assert.deepEqual(
    results.map((result) => result.id),
    ['cat-window', 'cat-play']
  );
});

test('google drive image library finds by id', async () => {
  const library = createLibrary();
  const result = await library.find('cat-play');

  assert.equal(result?.id, 'cat-play');
  assert.equal(result?.metadata.title, 'Playful cat');
});

test('google drive image library selects best matching image', async () => {
  const library = createLibrary();
  const candidates = await library.search({
    criteria: {
      tags: ['cat']
    }
  });
  const selected = await library.select(candidates, {
    topic: 'indoor cat play',
    tags: ['cat', 'indoor', 'play'],
    category: 'hero',
    aspectRatio: 'landscape',
    minimumRating: 4
  });

  assert.equal(selected?.id, 'cat-play');
});

test('google drive image library provider can be registered and resolved', async () => {
  const registry = new ProviderRegistry();

  registry.register(
    googleDriveImageLibraryToken,
    () =>
      new GoogleDriveImageLibrary({
        dryRun: true,
        records: mockRecords
      })
  );

  const library = await registry.resolve(googleDriveImageLibraryToken, { dryRun: true });
  const result = await library.find('cat-window');

  assert.equal(result?.metadata.title, 'Cat by window');
});

test('google drive image library makes no external api call', async () => {
  const library = createLibrary();
  const result = await library.random({ text: 'cat' });

  assert.match(result?.uri ?? '', /^mock:\/\//);
  assert.equal(result?.metadata.source?.metadata?.dryRun, true);
});

function createLibrary(): GoogleDriveImageLibrary {
  return new GoogleDriveImageLibrary({
    dryRun: true,
    records: mockRecords
  });
}

const mockRecords: GoogleDriveImageRecord[] = [
  {
    id: 'cat-window',
    filename: 'cat-window.jpg',
    title: 'Cat by window',
    description: 'Calm indoor cat near morning light.',
    tags: ['cat', 'indoor', 'calm'],
    category: 'article',
    width: 1600,
    height: 900,
    rating: 4,
    favorite: false,
    driveFileId: 'drive-file-cat-window',
    mockUri: 'mock://drive/cat-window.jpg',
    checksum: 'checksum-cat-window'
  },
  {
    id: 'cat-play',
    filename: 'cat-play.jpg',
    title: 'Playful cat',
    description: 'A playful indoor cat with toys.',
    tags: ['cat', 'indoor', 'play'],
    category: 'hero',
    width: 1800,
    height: 1000,
    rating: 5,
    favorite: true,
    driveFileId: 'drive-file-cat-play',
    mockUri: 'mock://drive/cat-play.jpg'
  },
  {
    id: 'dog-park',
    filename: 'dog-park.jpg',
    title: 'Dog at park',
    description: 'Outdoor dog image.',
    tags: ['dog', 'outdoor'],
    category: 'article',
    width: 1200,
    height: 800,
    rating: 4,
    favorite: false,
    driveFileId: 'drive-file-dog-park',
    mockUri: 'mock://drive/dog-park.jpg'
  }
];

