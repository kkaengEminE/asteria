import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  GoogleDriveStorageTransport,
  GoogleDriveTransportRequest,
  GoogleDriveTransportResponse
} from '../src/providers/storage/index.ts';
import {
  GoogleDriveStorageProvider,
  GoogleDriveStorageProviderError,
  googleDriveStorageProviderToken,
  ProviderRegistry
} from '../src/providers/index.ts';

test('google drive storage provider uploads a file with mocked transport', async () => {
  const transport = new MockGoogleDriveTransport();
  const provider = createProvider(transport);

  const metadata = await provider.uploadFile({
    path: 'articles/cat.md',
    content: '# Cat article',
    contentType: 'text/markdown'
  });

  assert.equal(metadata.path, 'articles/cat.md');
  assert.equal(metadata.name, 'cat.md');
  assert.equal(metadata.contentType, 'text/markdown');
  assert.equal(metadata.provider, 'google-drive-storage');
  assert.equal(transport.requests.some((request) => request.upload === true), true);
});

test('google drive storage provider downloads a file with mocked transport', async () => {
  const transport = new MockGoogleDriveTransport();
  const provider = createProvider(transport);

  await provider.uploadFile({
    path: 'articles/cat.md',
    content: '# Cat article',
    contentType: 'text/markdown'
  });

  const file = await provider.downloadFile({ path: 'articles/cat.md' });

  assert.equal(file.metadata.path, 'articles/cat.md');
  assert.equal(new TextDecoder().decode(file.content), '# Cat article');
});

test('google drive storage provider creates folders and lists files', async () => {
  const transport = new MockGoogleDriveTransport();
  const provider = createProvider(transport);

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

test('google drive storage provider returns metadata and null for missing files', async () => {
  const transport = new MockGoogleDriveTransport();
  const provider = createProvider(transport);

  await provider.uploadFile({ path: 'metadata/item.txt', content: 'hello' });

  const metadata = await provider.getFileMetadata('metadata/item.txt');
  const missing = await provider.getFileMetadata('metadata/missing.txt');

  assert.equal(metadata?.path, 'metadata/item.txt');
  assert.equal(metadata?.size, 5);
  assert.equal(missing, null);
});

test('google drive storage provider can be registered and resolved', async () => {
  const registry = new ProviderRegistry();
  const transport = new MockGoogleDriveTransport();

  registry.register(googleDriveStorageProviderToken, () => createProvider(transport));

  const provider = await registry.resolve(googleDriveStorageProviderToken, {
    magazineSlug: 'cat',
    dryRun: true
  });

  assert.equal(provider.name, 'google-drive-storage');
  assert.equal(registry.list('Storage')[0]?.name, 'google-drive-storage');
});

test('google drive storage provider reports disabled and missing configuration clearly', async () => {
  await assert.rejects(
    () => new GoogleDriveStorageProvider({
      config: {
        enabled: false,
        credentials: 'mock-credentials',
        rootFolderId: 'root',
        baseUrl: 'https://mock-drive.test/drive/v3',
        uploadBaseUrl: 'https://mock-drive.test/upload/drive/v3'
      },
      transport: new MockGoogleDriveTransport()
    }).listFiles(),
    /GOOGLE_DRIVE_ENABLED=true/
  );

  await assert.rejects(
    () => new GoogleDriveStorageProvider({
      config: {
        enabled: true,
        rootFolderId: 'root',
        baseUrl: 'https://mock-drive.test/drive/v3',
        uploadBaseUrl: 'https://mock-drive.test/upload/drive/v3'
      },
      transport: new MockGoogleDriveTransport()
    }).listFiles(),
    /GOOGLE_DRIVE_CREDENTIALS/
  );

  await assert.rejects(
    () => new GoogleDriveStorageProvider({
      config: {
        enabled: true,
        credentials: 'mock-credentials',
        baseUrl: 'https://mock-drive.test/drive/v3',
        uploadBaseUrl: 'https://mock-drive.test/upload/drive/v3'
      },
      transport: new MockGoogleDriveTransport()
    }).listFiles(),
    /GOOGLE_DRIVE_ROOT_FOLDER/
  );
});

test('google drive storage provider uses mocked transport without external calls', async () => {
  const transport = new MockGoogleDriveTransport();
  const provider = createProvider(transport);

  await provider.uploadFile({ path: 'mocked.txt', content: 'mocked' });

  assert.equal(transport.requests.length > 0, true);
  assert.equal(transport.requests.every((request) => request.path.startsWith('/files')), true);
});

function createProvider(transport: GoogleDriveStorageTransport): GoogleDriveStorageProvider {
  return new GoogleDriveStorageProvider({
    config: {
      enabled: true,
      credentials: 'mock-credentials',
      rootFolderId: 'root-folder',
      baseUrl: 'https://mock-drive.test/drive/v3',
      uploadBaseUrl: 'https://mock-drive.test/upload/drive/v3'
    },
    transport
  });
}

interface MockDriveRecord {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  parents: string[];
  appProperties: Record<string, string>;
  content?: string;
}

class MockGoogleDriveTransport implements GoogleDriveStorageTransport {
  readonly requests: GoogleDriveTransportRequest[] = [];
  private nextId = 1;
  private readonly records = new Map<string, MockDriveRecord>([
    ['root-folder', {
      id: 'root-folder',
      name: 'root',
      mimeType: 'application/vnd.google-apps.folder',
      size: '0',
      createdTime: '2026-01-01T00:00:00.000Z',
      modifiedTime: '2026-01-01T00:00:00.000Z',
      parents: [],
      appProperties: {
        storagePath: '.'
      }
    }]
  ]);

  async request(_config: unknown, request: GoogleDriveTransportRequest): Promise<GoogleDriveTransportResponse> {
    this.requests.push(request);

    if (request.method === 'GET' && request.path === '/files') {
      return {
        status: 200,
        body: {
          files: this.findByQuery(request.query?.q ?? '')
        }
      };
    }

    if (request.method === 'POST' && request.path === '/files') {
      return this.createRecord(request);
    }

    if (request.method === 'GET' && request.path.startsWith('/files/')) {
      const id = decodeURIComponent(request.path.replace('/files/', ''));
      const record = this.records.get(id);

      if (!record) {
        return {
          status: 404,
          body: {
            error: {
              message: 'File not found.'
            }
          }
        };
      }

      if (request.query?.alt === 'media') {
        return {
          status: 200,
          body: {
            content: record.content ?? ''
          }
        };
      }

      return {
        status: 200,
        body: record
      };
    }

    throw new GoogleDriveStorageProviderError(`Unexpected mock transport request: ${request.method} ${request.path}`);
  }

  private createRecord(request: GoogleDriveTransportRequest): GoogleDriveTransportResponse {
    const body = request.body as {
      metadata?: {
        name?: string;
        mimeType?: string;
        parents?: string[];
        appProperties?: Record<string, string>;
      };
      name?: string;
      mimeType?: string;
      parents?: string[];
      appProperties?: Record<string, string>;
      content?: string;
    };
    const metadata = body.metadata ?? body;
    const id = `drive-${this.nextId++}`;
    const now = '2026-01-01T00:00:00.000Z';
    const record: MockDriveRecord = {
      id,
      name: metadata.name ?? id,
      mimeType: metadata.mimeType,
      size: String(decodeBase64Length(body.content)),
      createdTime: now,
      modifiedTime: now,
      parents: metadata.parents ?? ['root-folder'],
      appProperties: metadata.appProperties ?? {},
      content: body.content
    };

    this.records.set(id, record);

    return {
      status: 200,
      body: record
    };
  }

  private findByQuery(query: string): MockDriveRecord[] {
    const path = matchQueryValue(query, /value='((?:\\'|[^'])*)'/);
    const parentId = matchQueryValue(query, /'([^']+)' in parents/);
    const mimeType = matchQueryValue(query, /mimeType = '((?:\\'|[^'])*)'/);

    return [...this.records.values()].filter((record) => {
      if (path !== null && record.appProperties.storagePath !== unescapeQueryValue(path)) {
        return false;
      }

      if (parentId !== null && !record.parents.includes(parentId)) {
        return false;
      }

      if (mimeType !== null && record.mimeType !== unescapeQueryValue(mimeType)) {
        return false;
      }

      return record.id !== 'root-folder';
    });
  }
}

function matchQueryValue(query: string, pattern: RegExp): string | null {
  return pattern.exec(query)?.[1] ?? null;
}

function unescapeQueryValue(value: string): string {
  return value.replaceAll("\\'", "'").replaceAll('\\\\', '\\');
}

function decodeBase64Length(content: string | undefined): number {
  return content ? Buffer.from(content, 'base64').byteLength : 0;
}
