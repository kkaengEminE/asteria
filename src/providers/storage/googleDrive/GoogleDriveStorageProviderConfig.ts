export interface GoogleDriveStorageProviderConfig {
  enabled: boolean;
  credentials?: string;
  rootFolderId?: string;
  baseUrl: string;
  uploadBaseUrl: string;
  name?: string;
}

export interface GoogleDriveStorageProviderEnvironment {
  GOOGLE_DRIVE_ENABLED?: string;
  GOOGLE_DRIVE_CREDENTIALS?: string;
  GOOGLE_DRIVE_ROOT_FOLDER?: string;
  GOOGLE_DRIVE_BASE_URL?: string;
  GOOGLE_DRIVE_UPLOAD_BASE_URL?: string;
}

export class GoogleDriveStorageProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleDriveStorageProviderConfigError';
  }
}

export function createGoogleDriveStorageProviderConfigFromEnv(
  env: GoogleDriveStorageProviderEnvironment = process.env
): GoogleDriveStorageProviderConfig {
  return {
    enabled: env.GOOGLE_DRIVE_ENABLED === 'true',
    credentials: env.GOOGLE_DRIVE_CREDENTIALS,
    rootFolderId: env.GOOGLE_DRIVE_ROOT_FOLDER,
    baseUrl: env.GOOGLE_DRIVE_BASE_URL ?? 'https://www.googleapis.com/drive/v3',
    uploadBaseUrl: env.GOOGLE_DRIVE_UPLOAD_BASE_URL ?? 'https://www.googleapis.com/upload/drive/v3'
  };
}

export function validateGoogleDriveStorageProviderConfig(
  config: GoogleDriveStorageProviderConfig
): void {
  if (!config.baseUrl || config.baseUrl.trim().length === 0) {
    throw new GoogleDriveStorageProviderConfigError('Google Drive storage config requires baseUrl.');
  }

  if (!config.uploadBaseUrl || config.uploadBaseUrl.trim().length === 0) {
    throw new GoogleDriveStorageProviderConfigError('Google Drive storage config requires uploadBaseUrl.');
  }
}
