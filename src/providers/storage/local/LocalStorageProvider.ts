import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
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
  validateLocalStorageProviderConfig,
  type LocalStorageProviderConfig
} from './LocalStorageProviderConfig.ts';

export const localStorageProviderToken = createProviderToken<StorageProvider>(
  'Storage',
  'local-storage',
  'Local filesystem storage provider for tests and dry-run development.'
);

export class LocalStoragePathError extends Error {
  constructor(path: string) {
    super(`Storage path escapes local root: ${path}`);
    this.name = 'LocalStoragePathError';
  }
}

export class LocalStorageProvider implements StorageProvider {
  readonly name: string;
  private readonly rootDir: string;

  constructor(config: LocalStorageProviderConfig) {
    validateLocalStorageProviderConfig(config);
    this.name = config.name ?? 'local-storage';
    this.rootDir = resolve(config.rootDir);
  }

  async uploadFile(request: StorageUploadFileRequest): Promise<StorageFileMetadata> {
    const filePath = this.resolveStoragePath(request.path);
    const content = normalizeContent(request.content);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content);

    const metadata = await this.createFileMetadata(filePath, request.contentType, request.metadata);
    return metadata;
  }

  async downloadFile(request: StorageDownloadFileRequest): Promise<StorageFile> {
    const filePath = this.resolveStoragePath(request.path);
    const content = await readFile(filePath);

    return {
      metadata: await this.createFileMetadata(filePath),
      content
    };
  }

  async listFiles(query: StorageListFilesQuery = {}): Promise<StorageFileMetadata[]> {
    const folderPath = this.resolveStoragePath(query.folderPath ?? '.');
    const entries = await collectFiles(folderPath, query.recursive ?? false);
    const metadata = await Promise.all(entries.map((entry) => this.createFileMetadata(entry)));

    return metadata.sort((left, right) => left.path.localeCompare(right.path));
  }

  async createFolder(request: StorageCreateFolderRequest): Promise<StorageFolder> {
    const folderPath = this.resolveStoragePath(request.path);

    await mkdir(folderPath, { recursive: true });
    const folderStat = await stat(folderPath);
    const storagePath = this.toStoragePath(folderPath);

    return {
      id: storagePath,
      path: storagePath,
      name: basename(folderPath),
      createdAt: folderStat.birthtime.toISOString(),
      provider: this.name,
      metadata: request.metadata
    };
  }

  async getFileMetadata(path: string): Promise<StorageFileMetadata | null> {
    try {
      return await this.createFileMetadata(this.resolveStoragePath(path));
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  private async createFileMetadata(
    filePath: string,
    contentType?: string,
    metadata?: Record<string, unknown>
  ): Promise<StorageFileMetadata> {
    const fileStat = await stat(filePath);
    const storagePath = this.toStoragePath(filePath);

    return {
      id: storagePath,
      path: storagePath,
      name: basename(filePath),
      size: fileStat.size,
      contentType,
      createdAt: fileStat.birthtime.toISOString(),
      updatedAt: fileStat.mtime.toISOString(),
      provider: this.name,
      metadata
    };
  }

  private resolveStoragePath(path: string): string {
    const resolved = resolve(this.rootDir, path);

    if (resolved !== this.rootDir && !resolved.startsWith(`${this.rootDir}${sep}`)) {
      throw new LocalStoragePathError(path);
    }

    return resolved;
  }

  private toStoragePath(path: string): string {
    const storagePath = relative(this.rootDir, path);
    return storagePath.length === 0 ? '.' : storagePath.split(sep).join('/');
  }
}

async function collectFiles(folderPath: string, recursive: boolean): Promise<string[]> {
  const entries = await readdir(folderPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(folderPath, entry.name);

    if (entry.isFile()) {
      files.push(entryPath);
      continue;
    }

    if (recursive && entry.isDirectory()) {
      files.push(...await collectFiles(entryPath, recursive));
    }
  }

  return files;
}

function normalizeContent(content: string | Uint8Array): Uint8Array {
  return typeof content === 'string' ? new TextEncoder().encode(content) : content;
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT';
}
