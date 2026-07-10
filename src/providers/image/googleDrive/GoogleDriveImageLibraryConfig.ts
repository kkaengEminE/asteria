import type { GoogleDriveImageRecord } from './GoogleDriveImageRecord.ts';
import type { StorageProvider } from '../../../domain/storage/index.ts';
import type { AssetLibrary } from '../../../services/assetLibrary/index.ts';

export interface GoogleDriveImageLibraryConfig {
  name?: string;
  dryRun: true;
  records: GoogleDriveImageRecord[];
  assetLibrary?: AssetLibrary;
  storageProvider?: StorageProvider;
}

export class GoogleDriveImageLibraryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleDriveImageLibraryConfigError';
  }
}

export function validateGoogleDriveImageLibraryConfig(config: GoogleDriveImageLibraryConfig): void {
  if (config.dryRun !== true) {
    throw new GoogleDriveImageLibraryConfigError('Google Drive image library draft only supports dryRun: true.');
  }

  if (!Array.isArray(config.records)) {
    throw new GoogleDriveImageLibraryConfigError('Google Drive image library config requires records.');
  }
}
