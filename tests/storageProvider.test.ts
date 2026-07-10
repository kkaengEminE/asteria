import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import type { StorageProvider } from '../src/domain/storage/index.ts';
import { ProviderRegistry } from '../src/providers/index.ts';
import {
  LocalStoragePathError,
  LocalStorageProvider,
  localStorageProviderToken
} from '../src/providers/storage/index.ts';

test('local storage provider can be registered and resolved', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'asteria-storage-'));
  const registry = new ProviderRegistry();

  registry.register(localStorageProviderToken, () => new LocalStorageProvider({ rootDir }));

  const provider = await registry.resolve(localStorageProviderToken, {
    magazineSlug: 'cat',
    dryRun: true
  });

  assert.equal(provider.name, 'local-storage');
  assert.equal(registry.list('Storage')[0]?.name, 'local-storage');
});

test('local storage provider uploads and downloads a file', async () => {
  const provider = await createProvider();

  const uploaded = await provider.uploadFile({
    path: 'articles/cat.md',
    content: '# Cat article',
    contentType: 'text/markdown',
    metadata: {
      dryRun: true
    }
  });
  const downloaded = await provider.downloadFile({ path: 'articles/cat.md' });

  assert.equal(uploaded.path, 'articles/cat.md');
  assert.equal(uploaded.name, 'cat.md');
  assert.equal(uploaded.contentType, 'text/markdown');
  assert.equal(new TextDecoder().decode(downloaded.content), '# Cat article');
  assert.equal(downloaded.metadata.path, 'articles/cat.md');
});

test('local storage provider creates folders and lists files', async () => {
  const provider = await createProvider();

  const folder = await provider.createFolder({ path: 'reports/quality' });
  await provider.uploadFile({ path: 'reports/quality/one.md', content: 'one' });
  await provider.uploadFile({ path: 'reports/quality/two.md', content: 'two' });

  const files = await provider.listFiles({
    folderPath: 'reports',
    recursive: true
  });

  assert.equal(folder.path, 'reports/quality');
  assert.deepEqual(files.map((file) => file.path), [
    'reports/quality/one.md',
    'reports/quality/two.md'
  ]);
});

test('local storage provider returns metadata and null for missing files', async () => {
  const provider = await createProvider();

  await provider.uploadFile({ path: 'metadata/item.txt', content: 'hello' });

  const metadata = await provider.getFileMetadata('metadata/item.txt');
  const missing = await provider.getFileMetadata('metadata/missing.txt');

  assert.equal(metadata?.path, 'metadata/item.txt');
  assert.equal(metadata?.size, 5);
  assert.equal(missing, null);
});

test('local storage provider rejects paths outside root', async () => {
  const provider = await createProvider();

  await assert.rejects(
    () => provider.uploadFile({ path: '../escape.txt', content: 'nope' }),
    LocalStoragePathError
  );
});

async function createProvider(): Promise<StorageProvider> {
  const rootDir = await mkdtemp(join(tmpdir(), 'asteria-storage-'));
  return new LocalStorageProvider({ rootDir });
}
