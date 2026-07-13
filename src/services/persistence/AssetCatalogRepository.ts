import type { Asset } from '../../domain/asset/index.ts';
import type { PageRequest, PageResult, RevisionCheck, Revisioned } from './PersistenceTypes.ts';

export interface AssetCatalogQuery extends PageRequest {
  category?: string;
  tags?: string[];
  mimeType?: string;
  activeOnly?: boolean;
}

export interface AssetCatalogRepository {
  register(asset: Asset): Promise<Revisioned<Asset>>;
  getById(id: string): Promise<Revisioned<Asset> | undefined>;
  findByChecksum(checksum: string): Promise<Revisioned<Asset> | undefined>;
  list(query?: AssetCatalogQuery): Promise<PageResult<Revisioned<Asset>>>;
  updateMetadata(
    id: string,
    metadata: Record<string, unknown>,
    revision?: RevisionCheck
  ): Promise<Revisioned<Asset>>;
  deactivate(id: string, reason: string, revision?: RevisionCheck): Promise<Revisioned<Asset>>;
}

