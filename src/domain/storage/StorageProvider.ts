import type { StorageFile } from './StorageFile.ts';
import type { StorageFileMetadata } from './StorageFileMetadata.ts';
import type { StorageFolder } from './StorageFolder.ts';

export interface StorageUploadFileRequest {
  path: string;
  content: string | Uint8Array;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export interface StorageDownloadFileRequest {
  path: string;
}

export interface StorageListFilesQuery {
  folderPath?: string;
  recursive?: boolean;
}

export interface StorageCreateFolderRequest {
  path: string;
  metadata?: Record<string, unknown>;
}

export interface StorageProvider {
  readonly name: string;
  uploadFile(request: StorageUploadFileRequest): Promise<StorageFileMetadata>;
  downloadFile(request: StorageDownloadFileRequest): Promise<StorageFile>;
  listFiles(query?: StorageListFilesQuery): Promise<StorageFileMetadata[]>;
  createFolder(request: StorageCreateFolderRequest): Promise<StorageFolder>;
  getFileMetadata(path: string): Promise<StorageFileMetadata | null>;
}
