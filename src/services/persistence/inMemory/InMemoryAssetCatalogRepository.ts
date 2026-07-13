import type { Asset } from '../../../domain/asset/index.ts';
import type { AssetCatalogQuery, AssetCatalogRepository } from '../AssetCatalogRepository.ts';
import type { PageResult, RevisionCheck, Revisioned } from '../PersistenceTypes.ts';
import { cloneRevisioned, createRevisioned, nextRevision, pageItems } from './InMemoryRepositoryUtils.ts';

export class InMemoryAssetCatalogRepository implements AssetCatalogRepository {
  private readonly assets = new Map<string, Revisioned<Asset>>();

  async register(asset: Asset): Promise<Revisioned<Asset>> {
    const existing = this.assets.get(asset.id);
    const record = existing ? nextRevision(existing, asset) : createRevisioned(asset);
    this.assets.set(asset.id, record);
    return cloneRevisioned(record);
  }

  async getById(id: string): Promise<Revisioned<Asset> | undefined> {
    const record = this.assets.get(id);
    return record ? cloneRevisioned(record) : undefined;
  }

  async findByChecksum(checksum: string): Promise<Revisioned<Asset> | undefined> {
    const record = [...this.assets.values()].find((candidate) => candidate.value.metadata?.checksum === checksum);
    return record ? cloneRevisioned(record) : undefined;
  }

  async list(query: AssetCatalogQuery = {}): Promise<PageResult<Revisioned<Asset>>> {
    const filtered = [...this.assets.values()]
      .filter((record) => !query.category || record.value.category === query.category)
      .filter((record) => !query.mimeType || record.value.mimeType === query.mimeType)
      .filter((record) => !query.activeOnly || record.value.metadata?.active !== false)
      .filter((record) => {
        if (!query.tags || query.tags.length === 0) {
          return true;
        }

        return query.tags.every((tag) => record.value.tags.includes(tag));
      })
      .map(cloneRevisioned);

    return pageItems(filtered, query);
  }

  async updateMetadata(
    id: string,
    metadata: Record<string, unknown>,
    revision?: RevisionCheck
  ): Promise<Revisioned<Asset>> {
    const current = this.require(id);
    const updated = nextRevision(current, {
      ...current.value,
      metadata: {
        ...current.value.metadata,
        ...metadata
      }
    }, revision);

    this.assets.set(id, updated);
    return cloneRevisioned(updated);
  }

  async deactivate(id: string, reason: string, revision?: RevisionCheck): Promise<Revisioned<Asset>> {
    const current = this.require(id);
    const updated = nextRevision(current, {
      ...current.value,
      metadata: {
        ...current.value.metadata,
        active: false,
        deactivationReason: reason,
        deactivatedAt: new Date().toISOString()
      }
    }, revision);

    this.assets.set(id, updated);
    return cloneRevisioned(updated);
  }

  private require(id: string): Revisioned<Asset> {
    const record = this.assets.get(id);

    if (!record) {
      throw new Error(`Asset was not found: ${id}.`);
    }

    return record;
  }
}
