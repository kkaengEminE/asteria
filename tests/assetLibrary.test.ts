import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { AssetValidationError } from '../src/domain/asset/index.ts';
import { LocalStorageProvider } from '../src/providers/storage/index.ts';
import { AssetLibrary } from '../src/services/assetLibrary/index.ts';

test('asset library registers an asset through storage provider', async () => {
  const library = await createAssetLibrary();

  const asset = await library.registerAsset({
    id: 'cat-hero',
    filename: 'cat-hero.jpg',
    mimeType: 'image/jpeg',
    category: 'hero',
    tags: ['Cat', 'Hero', 'cat'],
    storagePath: 'images/cat-hero.jpg',
    storageUri: 'mock://assets/cat-hero.jpg',
    content: 'image-bytes',
    metadata: {
      title: 'Cat Hero',
      width: 1600,
      height: 900,
      rating: 5,
      favorite: true
    }
  });

  assert.equal(asset.id, 'cat-hero');
  assert.equal(asset.size, 11);
  assert.deepEqual(asset.tags, ['cat', 'hero']);
  assert.equal(asset.storageReference.provider, 'local-storage');
  assert.equal(asset.storageReference.path, 'images/cat-hero.jpg');
});

test('asset library looks up assets and metadata', async () => {
  const library = await createAssetLibrary();

  await library.registerAsset({
    id: 'cat-window',
    filename: 'cat-window.jpg',
    mimeType: 'image/jpeg',
    category: 'article',
    tags: ['cat', 'window'],
    content: 'window-image',
    metadata: {
      title: 'Cat by Window'
    }
  });

  const asset = await library.findAsset('cat-window');
  const metadata = await library.getAssetMetadata('cat-window');
  const missing = await library.findAsset('missing');

  assert.equal(asset?.filename, 'cat-window.jpg');
  assert.equal(metadata?.metadata?.title, 'Cat by Window');
  assert.equal(missing, null);
});

test('asset library retrieves image asset projection', async () => {
  const library = await createAssetLibrary();

  await library.registerAsset({
    id: 'cat-play',
    filename: 'cat-play.png',
    mimeType: 'image/png',
    category: 'hero',
    tags: ['cat', 'play'],
    storageUri: 'mock://assets/cat-play.png',
    content: 'png-bytes',
    metadata: {
      title: 'Cat Play',
      description: 'A cat playing indoors.',
      width: 1200,
      height: 1200,
      rating: 4,
      favorite: false,
      driveFileId: 'drive-cat-play'
    }
  });

  const image = await library.getImageAsset('cat-play');

  assert.equal(image?.id, 'cat-play');
  assert.equal(image?.uri, 'mock://assets/cat-play.png');
  assert.equal(image?.metadata.orientation, 'square');
  assert.equal(image?.metadata.source?.externalId, 'drive-cat-play');
});

test('asset library downloads registered asset content through storage provider', async () => {
  const library = await createAssetLibrary();

  await library.registerAsset({
    id: 'asset-file',
    filename: 'asset-file.txt',
    mimeType: 'text/plain',
    content: 'hello asset'
  });

  const file = await library.getAssetFile('asset-file');

  assert.equal(file?.asset.size, 11);
  assert.equal(new TextDecoder().decode(file?.content), 'hello asset');
});

test('asset validation rejects incomplete registration', async () => {
  const library = await createAssetLibrary();

  await assert.rejects(
    () => library.registerAsset({
      id: '',
      filename: 'missing-id.jpg',
      mimeType: 'image/jpeg',
      content: 'content'
    }),
    AssetValidationError
  );
});

async function createAssetLibrary(): Promise<AssetLibrary> {
  const rootDir = await mkdtemp(join(tmpdir(), 'asteria-assets-'));
  return new AssetLibrary({
    storageProvider: new LocalStorageProvider({ rootDir })
  });
}
