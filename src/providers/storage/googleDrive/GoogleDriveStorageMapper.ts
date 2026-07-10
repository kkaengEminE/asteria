import type {
  StorageFile,
  StorageFileMetadata,
  StorageFolder
} from '../../../domain/storage/index.ts';

export interface GoogleDriveFileRecord {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  md5Checksum?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
}

export interface GoogleDriveListResponse {
  files?: GoogleDriveFileRecord[];
}

export interface GoogleDriveErrorResponse {
  error?: {
    message?: string;
  };
}

export const googleDriveFolderMimeType = 'application/vnd.google-apps.folder';

export function isGoogleDriveFileRecord(value: unknown): value is GoogleDriveFileRecord {
  return typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id?: unknown }).id === 'string' &&
    'name' in value &&
    typeof (value as { name?: unknown }).name === 'string';
}

export function isGoogleDriveListResponse(value: unknown): value is GoogleDriveListResponse {
  return typeof value === 'object' && value !== null && Array.isArray((value as { files?: unknown }).files);
}

export function mapGoogleDriveRecordToMetadata(
  record: GoogleDriveFileRecord,
  path: string,
  provider: string
): StorageFileMetadata {
  return {
    id: record.id,
    path,
    name: record.name,
    size: Number.parseInt(record.size ?? '0', 10) || 0,
    contentType: record.mimeType,
    checksum: record.md5Checksum,
    createdAt: record.createdTime,
    updatedAt: record.modifiedTime,
    provider,
    metadata: {
      driveFileId: record.id,
      driveParents: record.parents,
      driveAppProperties: record.appProperties
    }
  };
}

export function mapGoogleDriveRecordToFolder(
  record: GoogleDriveFileRecord,
  path: string,
  provider: string
): StorageFolder {
  return {
    id: record.id,
    path,
    name: record.name,
    createdAt: record.createdTime,
    provider,
    metadata: {
      driveFolderId: record.id,
      driveParents: record.parents,
      driveAppProperties: record.appProperties
    }
  };
}

export function mapGoogleDriveRecordToFile(
  record: GoogleDriveFileRecord,
  path: string,
  content: Uint8Array,
  provider: string
): StorageFile {
  return {
    metadata: mapGoogleDriveRecordToMetadata(record, path, provider),
    content
  };
}

export function extractGoogleDriveErrorMessage(body: unknown): string {
  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }

  if (typeof body === 'object' && body !== null) {
    const error = (body as GoogleDriveErrorResponse).error;

    if (error?.message) {
      return error.message;
    }
  }

  return 'Google Drive storage request failed.';
}
