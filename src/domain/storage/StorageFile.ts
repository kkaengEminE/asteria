import type { StorageFileMetadata } from './StorageFileMetadata.ts';

export interface StorageFile {
  metadata: StorageFileMetadata;
  content: Uint8Array;
}
