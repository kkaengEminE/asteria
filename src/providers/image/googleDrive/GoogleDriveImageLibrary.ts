import {
  createImageMetadata,
  matchesImageSearchQuery,
  scoreImageAsset,
  selectHighestScoredImage,
  type ImageAsset,
  type ImageDomainLibrary,
  type ImageSearchQuery,
  type ImageSelectionCriteria
} from '../../../domain/image/index.ts';
import { AssetLibrary, mapAssetToImageAsset } from '../../../services/assetLibrary/index.ts';
import { InMemoryAssetCatalogRepository } from '../../../services/persistence/index.ts';
import { LocalStorageProvider } from '../../storage/index.ts';
import { createProviderToken } from '../../ProviderToken.ts';
import {
  validateGoogleDriveImageLibraryConfig,
  type GoogleDriveImageLibraryConfig
} from './GoogleDriveImageLibraryConfig.ts';
import type { GoogleDriveImageRecord } from './GoogleDriveImageRecord.ts';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let defaultStorageInstanceId = 1;

export const googleDriveImageLibraryToken = createProviderToken<ImageDomainLibrary>(
  'Image',
  'google-drive',
  'Mock-first Google Drive image library adapter.'
);

export class GoogleDriveImageLibrary implements ImageDomainLibrary {
  readonly name: string;
  private readonly records: GoogleDriveImageRecord[];
  private readonly assetLibrary: AssetLibrary;
  private assetsReady?: Promise<void>;

  constructor(config: GoogleDriveImageLibraryConfig) {
    validateGoogleDriveImageLibraryConfig(config);
    this.name = config.name ?? 'google-drive';
    this.records = config.records;
    this.assetLibrary = config.assetLibrary ?? new AssetLibrary({
      storageProvider: config.storageProvider ?? new LocalStorageProvider({
        rootDir: join(tmpdir(), `asteria-google-drive-image-assets-${process.pid}-${defaultStorageInstanceId++}`)
      }),
      catalogRepository: new InMemoryAssetCatalogRepository()
    });
  }

  async search(query: ImageSearchQuery): Promise<ImageAsset[]> {
    const assets = await this.listImageAssets();
    const matches = assets.filter((asset) => matchesImageSearchQuery(asset, query));
    return typeof query.limit === 'number' ? matches.slice(0, query.limit) : matches;
  }

  async find(id: string): Promise<ImageAsset | null> {
    await this.ensureAssetsRegistered();
    return this.assetLibrary.getImageAsset(id);
  }

  async random(query: ImageSearchQuery = {}): Promise<ImageAsset | null> {
    const candidates = await this.search(query);

    if (candidates.length === 0) {
      return null;
    }

    const index = stableIndex(query.text ?? candidates.map((candidate) => candidate.id).join(':'), candidates.length);
    return candidates[index] ?? null;
  }

  async score(asset: ImageAsset, criteria: ImageSelectionCriteria): Promise<number> {
    return scoreImageAsset(asset, criteria).score;
  }

  async select(candidates: ImageAsset[], criteria: ImageSelectionCriteria): Promise<ImageAsset | null> {
    return selectHighestScoredImage(candidates, criteria);
  }

  private async listImageAssets(): Promise<ImageAsset[]> {
    await this.ensureAssetsRegistered();
    const assets = await this.assetLibrary.listAssets();

    return assets.map(mapAssetToImageAsset);
  }

  private async ensureAssetsRegistered(): Promise<void> {
    this.assetsReady ??= (async () => {
      for (const record of this.records) {
        await this.assetLibrary.registerAsset({
          id: record.id,
          filename: record.filename,
          mimeType: inferImageMimeType(record.filename),
          category: record.category,
          tags: record.tags,
          storagePath: `images/${record.filename}`,
          storageUri: record.mockUri,
          metadata: {
            title: record.title,
            description: record.description,
            width: record.width,
            height: record.height,
            takenAt: record.takenAt,
            rating: record.rating,
            favorite: record.favorite,
            checksum: record.checksum,
            driveFileId: record.driveFileId,
            dryRun: true
          }
        });
      }
    })();

    await this.assetsReady;
  }
}

export function mapGoogleDriveRecordToImageAsset(record: GoogleDriveImageRecord): ImageAsset {
  return {
    id: record.id,
    uri: record.mockUri,
    metadata: createImageMetadata({
      filename: record.filename,
      title: record.title,
      description: record.description,
      tags: record.tags,
      category: record.category,
      width: record.width,
      height: record.height,
      takenAt: record.takenAt,
      rating: record.rating,
      favorite: record.favorite,
      checksum: record.checksum,
      source: {
        provider: 'google-drive',
        externalId: record.driveFileId,
        url: record.mockUri,
        metadata: {
          dryRun: true
        }
      }
    })
  };
}

function stableIndex(seed: string, length: number): number {
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 10000;
  }

  return hash % length;
}

function inferImageMimeType(filename: string): string {
  const lower = filename.toLowerCase();

  if (lower.endsWith('.png')) {
    return 'image/png';
  }

  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'image/jpeg';
}
