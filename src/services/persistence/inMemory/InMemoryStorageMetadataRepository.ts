import type { StorageFileMetadata, StorageFolder } from '../../../domain/storage/index.ts';
import type { PageResult, Revisioned } from '../PersistenceTypes.ts';
import type { StorageMetadataQuery, StorageMetadataRepository } from '../StorageMetadataRepository.ts';
import { cloneRevisioned, createRevisioned, pageItems } from './InMemoryRepositoryUtils.ts';

export class InMemoryStorageMetadataRepository implements StorageMetadataRepository {
  private readonly files = new Map<string, Revisioned<StorageFileMetadata>>();
  private readonly folders = new Map<string, Revisioned<StorageFolder>>();

  async recordFile(metadata: StorageFileMetadata): Promise<Revisioned<StorageFileMetadata>> {
    const existing = this.files.get(metadata.id);
    const record = createRevisioned(metadata, existing ? existing.revision + 1 : 1);
    this.files.set(metadata.id, record);
    return cloneRevisioned(record);
  }

  async getFile(id: string): Promise<Revisioned<StorageFileMetadata> | undefined> {
    const record = this.files.get(id);
    return record ? cloneRevisioned(record) : undefined;
  }

  async listFiles(query: StorageMetadataQuery = {}): Promise<PageResult<Revisioned<StorageFileMetadata>>> {
    const filtered = [...this.files.values()]
      .filter((record) => !query.provider || record.value.provider === query.provider)
      .filter((record) => !query.pathPrefix || record.value.path.startsWith(query.pathPrefix))
      .filter((record) => !query.contentType || record.value.contentType === query.contentType)
      .sort((left, right) => left.value.path.localeCompare(right.value.path))
      .map(cloneRevisioned);

    return pageItems(filtered, query);
  }

  async recordFolder(folder: StorageFolder): Promise<Revisioned<StorageFolder>> {
    const existing = this.folders.get(folder.id);
    const record = createRevisioned(folder, existing ? existing.revision + 1 : 1);
    this.folders.set(folder.id, record);
    return cloneRevisioned(record);
  }

  async getFolder(id: string): Promise<Revisioned<StorageFolder> | undefined> {
    const record = this.folders.get(id);
    return record ? cloneRevisioned(record) : undefined;
  }
}
