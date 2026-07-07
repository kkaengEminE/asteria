import {
  createImageAsset,
  createImageMetadata,
  matchesImageSearchQuery,
  scoreImageAsset,
  selectHighestScoredImage,
  type ImageAsset,
  type ImageDomainLibrary,
  type ImageSearchQuery,
  type ImageSelectionCriteria
} from '../../../domain/image/index.ts';
import { createProviderToken } from '../../ProviderToken.ts';
import {
  validateGoogleDriveImageLibraryConfig,
  type GoogleDriveImageLibraryConfig
} from './GoogleDriveImageLibraryConfig.ts';
import type { GoogleDriveImageRecord } from './GoogleDriveImageRecord.ts';

export const googleDriveImageLibraryToken = createProviderToken<ImageDomainLibrary>(
  'Image',
  'google-drive',
  'Mock-first Google Drive image library adapter.'
);

export class GoogleDriveImageLibrary implements ImageDomainLibrary {
  readonly name: string;
  private readonly assets: ImageAsset[];

  constructor(config: GoogleDriveImageLibraryConfig) {
    validateGoogleDriveImageLibraryConfig(config);
    this.name = config.name ?? 'google-drive';
    this.assets = config.records.map(mapGoogleDriveRecordToImageAsset);
  }

  async search(query: ImageSearchQuery): Promise<ImageAsset[]> {
    const matches = this.assets.filter((asset) => matchesImageSearchQuery(asset, query));
    return typeof query.limit === 'number' ? matches.slice(0, query.limit) : matches;
  }

  async find(id: string): Promise<ImageAsset | null> {
    return this.assets.find((asset) => asset.id === id) ?? null;
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
}

export function mapGoogleDriveRecordToImageAsset(record: GoogleDriveImageRecord): ImageAsset {
  return createImageAsset({
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
  });
}

function stableIndex(seed: string, length: number): number {
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 10000;
  }

  return hash % length;
}

