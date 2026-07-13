import type { StorageFileMetadata, StorageFolder } from '../../domain/storage/index.ts';
import type { PageRequest, PageResult, Revisioned } from './PersistenceTypes.ts';

export interface StorageMetadataQuery extends PageRequest {
  provider?: string;
  pathPrefix?: string;
  contentType?: string;
}

export interface StorageMetadataRepository {
  recordFile(metadata: StorageFileMetadata): Promise<Revisioned<StorageFileMetadata>>;
  getFile(id: string): Promise<Revisioned<StorageFileMetadata> | undefined>;
  listFiles(query?: StorageMetadataQuery): Promise<PageResult<Revisioned<StorageFileMetadata>>>;
  recordFolder(folder: StorageFolder): Promise<Revisioned<StorageFolder>>;
  getFolder(id: string): Promise<Revisioned<StorageFolder> | undefined>;
}

