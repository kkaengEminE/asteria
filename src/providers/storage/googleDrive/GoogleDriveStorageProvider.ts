import { basename, dirname, join } from 'node:path';
import type {
  StorageCreateFolderRequest,
  StorageDownloadFileRequest,
  StorageFile,
  StorageFileMetadata,
  StorageFolder,
  StorageListFilesQuery,
  StorageProvider,
  StorageUploadFileRequest
} from '../../../domain/storage/index.ts';
import { createProviderToken } from '../../ProviderToken.ts';
import {
  createGoogleDriveStorageProviderConfigFromEnv,
  validateGoogleDriveStorageProviderConfig,
  type GoogleDriveStorageProviderConfig,
  type GoogleDriveStorageProviderEnvironment
} from './GoogleDriveStorageProviderConfig.ts';
import {
  extractGoogleDriveErrorMessage,
  googleDriveFolderMimeType,
  isGoogleDriveFileRecord,
  isGoogleDriveListResponse,
  mapGoogleDriveRecordToFile,
  mapGoogleDriveRecordToFolder,
  mapGoogleDriveRecordToMetadata,
  type GoogleDriveFileRecord
} from './GoogleDriveStorageMapper.ts';
import {
  FetchGoogleDriveStorageTransport,
  type GoogleDriveStorageTransport
} from './GoogleDriveStorageTransport.ts';

export const googleDriveStorageProviderToken = createProviderToken<StorageProvider>(
  'Storage',
  'google-drive-storage',
  'Google Drive adapter behind the provider-neutral StorageProvider interface.'
);

export interface GoogleDriveStorageProviderOptions {
  config?: GoogleDriveStorageProviderConfig;
  env?: GoogleDriveStorageProviderEnvironment;
  transport?: GoogleDriveStorageTransport;
}

export class GoogleDriveStorageProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleDriveStorageProviderError';
  }
}

export class GoogleDriveStorageProvider implements StorageProvider {
  readonly name: string;
  private readonly config: GoogleDriveStorageProviderConfig;
  private readonly transport: GoogleDriveStorageTransport;

  constructor(options: GoogleDriveStorageProviderOptions = {}) {
    this.config = options.config ?? createGoogleDriveStorageProviderConfigFromEnv(options.env);
    validateGoogleDriveStorageProviderConfig(this.config);
    this.transport = options.transport ?? new FetchGoogleDriveStorageTransport();
    this.name = this.config.name ?? 'google-drive-storage';
  }

  async uploadFile(request: StorageUploadFileRequest): Promise<StorageFileMetadata> {
    this.assertReady();
    const normalizedPath = normalizeStoragePath(request.path);
    const parentId = await this.ensureFolderPath(dirname(normalizedPath));
    const fileName = basename(normalizedPath);
    const response = await this.transport.request(this.config, {
      method: 'POST',
      path: '/files',
      upload: true,
      query: {
        uploadType: 'multipart',
        fields: googleDriveFields
      },
      body: {
        metadata: {
          name: fileName,
          parents: [parentId],
          mimeType: request.contentType,
          appProperties: {
            storagePath: normalizedPath
          }
        },
        content: encodeContent(request.content)
      }
    });

    const record = this.expectFileRecord(response);
    return mapGoogleDriveRecordToMetadata(record, normalizedPath, this.name);
  }

  async downloadFile(request: StorageDownloadFileRequest): Promise<StorageFile> {
    this.assertReady();
    const normalizedPath = normalizeStoragePath(request.path);
    const record = await this.findFileRecord(normalizedPath);

    if (!record) {
      throw new GoogleDriveStorageProviderError(`Google Drive file was not found: ${normalizedPath}`);
    }

    const response = await this.transport.request(this.config, {
      method: 'GET',
      path: `/files/${encodeURIComponent(record.id)}`,
      query: {
        alt: 'media'
      }
    });

    if (response.status < 200 || response.status >= 300) {
      throw new GoogleDriveStorageProviderError(extractGoogleDriveErrorMessage(response.body));
    }

    return mapGoogleDriveRecordToFile(record, normalizedPath, decodeContent(response.body), this.name);
  }

  async listFiles(query: StorageListFilesQuery = {}): Promise<StorageFileMetadata[]> {
    this.assertReady();
    const folderPath = normalizeFolderPath(query.folderPath ?? '.');
    const folderId = folderPath === '.' ? this.config.rootFolderId! : await this.findFolderId(folderPath);

    if (!folderId) {
      return [];
    }

    const records = await this.listChildren(folderId);
    const files = records.filter((record) => record.mimeType !== googleDriveFolderMimeType);
    const folders = records.filter((record) => record.mimeType === googleDriveFolderMimeType);
    const currentFiles = files.map((record) => {
      const path = folderPath === '.' ? record.name : join(folderPath, record.name).split('\\').join('/');
      return mapGoogleDriveRecordToMetadata(record, path, this.name);
    });

    if (!query.recursive) {
      return currentFiles.sort((left, right) => left.path.localeCompare(right.path));
    }

    const nestedFiles = await Promise.all(folders.map(async (folder) => {
      const path = folderPath === '.' ? folder.name : join(folderPath, folder.name).split('\\').join('/');
      return this.listFiles({ folderPath: path, recursive: true });
    }));

    return [...currentFiles, ...nestedFiles.flat()].sort((left, right) => left.path.localeCompare(right.path));
  }

  async createFolder(request: StorageCreateFolderRequest): Promise<StorageFolder> {
    this.assertReady();
    const folderPath = normalizeFolderPath(request.path);
    const existing = await this.findFolderRecord(folderPath);

    if (existing) {
      return mapGoogleDriveRecordToFolder(existing, folderPath, this.name);
    }

    const parentPath = dirname(folderPath);
    const parentId = await this.ensureFolderPath(parentPath);
    const response = await this.transport.request(this.config, {
      method: 'POST',
      path: '/files',
      query: {
        fields: googleDriveFields
      },
      body: {
        name: basename(folderPath),
        mimeType: googleDriveFolderMimeType,
        parents: [parentId],
        appProperties: {
          storagePath: folderPath,
          ...stringifyMetadata(request.metadata)
        }
      }
    });

    const record = this.expectFileRecord(response);
    return mapGoogleDriveRecordToFolder(record, folderPath, this.name);
  }

  async getFileMetadata(path: string): Promise<StorageFileMetadata | null> {
    this.assertReady();
    const normalizedPath = normalizeStoragePath(path);
    const record = await this.findFileRecord(normalizedPath);
    return record ? mapGoogleDriveRecordToMetadata(record, normalizedPath, this.name) : null;
  }

  private assertReady(): void {
    if (!this.config.enabled) {
      throw new GoogleDriveStorageProviderError(
        'Google Drive storage provider is disabled. Set GOOGLE_DRIVE_ENABLED=true.'
      );
    }

    if (!this.config.credentials || this.config.credentials.trim().length === 0) {
      throw new GoogleDriveStorageProviderError(
        'Google Drive credentials are missing. Set GOOGLE_DRIVE_CREDENTIALS.'
      );
    }

    if (!this.config.rootFolderId || this.config.rootFolderId.trim().length === 0) {
      throw new GoogleDriveStorageProviderError(
        'Google Drive root folder is missing. Set GOOGLE_DRIVE_ROOT_FOLDER.'
      );
    }
  }

  private async ensureFolderPath(path: string): Promise<string> {
    const folderPath = normalizeFolderPath(path);

    if (folderPath === '.') {
      return this.config.rootFolderId!;
    }

    const existing = await this.findFolderRecord(folderPath);

    if (existing) {
      return existing.id;
    }

    const parentId = await this.ensureFolderPath(dirname(folderPath));
    const response = await this.transport.request(this.config, {
      method: 'POST',
      path: '/files',
      query: {
        fields: googleDriveFields
      },
      body: {
        name: basename(folderPath),
        mimeType: googleDriveFolderMimeType,
        parents: [parentId],
        appProperties: {
          storagePath: folderPath
        }
      }
    });

    return this.expectFileRecord(response).id;
  }

  private async findFolderId(path: string): Promise<string | null> {
    const record = await this.findFolderRecord(path);
    return record?.id ?? null;
  }

  private async findFolderRecord(path: string): Promise<GoogleDriveFileRecord | null> {
    const folderPath = normalizeFolderPath(path);
    return this.findRecordByPath(folderPath, googleDriveFolderMimeType);
  }

  private async findFileRecord(path: string): Promise<GoogleDriveFileRecord | null> {
    return this.findRecordByPath(normalizeStoragePath(path));
  }

  private async findRecordByPath(path: string, mimeType?: string): Promise<GoogleDriveFileRecord | null> {
    const response = await this.transport.request(this.config, {
      method: 'GET',
      path: '/files',
      query: {
        q: createPathQuery(path, mimeType),
        fields: `files(${googleDriveFields})`
      }
    });

    if (response.status < 200 || response.status >= 300) {
      throw new GoogleDriveStorageProviderError(extractGoogleDriveErrorMessage(response.body));
    }

    if (!isGoogleDriveListResponse(response.body)) {
      throw new GoogleDriveStorageProviderError('Google Drive list response was malformed.');
    }

    return response.body.files?.[0] ?? null;
  }

  private async listChildren(folderId: string): Promise<GoogleDriveFileRecord[]> {
    const response = await this.transport.request(this.config, {
      method: 'GET',
      path: '/files',
      query: {
        q: `'${folderId}' in parents and trashed = false`,
        fields: `files(${googleDriveFields})`
      }
    });

    if (response.status < 200 || response.status >= 300) {
      throw new GoogleDriveStorageProviderError(extractGoogleDriveErrorMessage(response.body));
    }

    if (!isGoogleDriveListResponse(response.body)) {
      throw new GoogleDriveStorageProviderError('Google Drive list response was malformed.');
    }

    return response.body.files ?? [];
  }

  private expectFileRecord(response: { status: number; body?: unknown }): GoogleDriveFileRecord {
    if (response.status < 200 || response.status >= 300) {
      throw new GoogleDriveStorageProviderError(extractGoogleDriveErrorMessage(response.body));
    }

    if (!isGoogleDriveFileRecord(response.body)) {
      throw new GoogleDriveStorageProviderError('Google Drive file response was malformed.');
    }

    return response.body;
  }
}

const googleDriveFields = 'id,name,mimeType,size,md5Checksum,createdTime,modifiedTime,parents,appProperties';

function normalizeStoragePath(path: string): string {
  const normalized = path.trim().replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+/g, '/');

  if (normalized.length === 0 || normalized === '.' || normalized.includes('..')) {
    throw new GoogleDriveStorageProviderError(`Invalid Google Drive storage path: ${path}`);
  }

  return normalized;
}

function normalizeFolderPath(path: string): string {
  if (path === '.' || path.trim().length === 0) {
    return '.';
  }

  return normalizeStoragePath(path);
}

function createPathQuery(path: string, mimeType?: string): string {
  const parts = [
    `appProperties has { key='storagePath' and value='${escapeDriveQuery(path)}' }`,
    'trashed = false'
  ];

  if (mimeType) {
    parts.push(`mimeType = '${escapeDriveQuery(mimeType)}'`);
  }

  return parts.join(' and ');
}

function escapeDriveQuery(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function encodeContent(content: string | Uint8Array): string {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  return Buffer.from(bytes).toString('base64');
}

function decodeContent(body: unknown): Uint8Array {
  if (body instanceof Uint8Array) {
    return body;
  }

  if (typeof body === 'string') {
    return new TextEncoder().encode(body);
  }

  if (typeof body === 'object' && body !== null && typeof (body as { content?: unknown }).content === 'string') {
    return Buffer.from((body as { content: string }).content, 'base64');
  }

  return new Uint8Array();
}

function stringifyMetadata(metadata: Record<string, unknown> | undefined): Record<string, string> {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  );
}
