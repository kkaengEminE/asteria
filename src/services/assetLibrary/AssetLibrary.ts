import type { Asset, AssetFile, AssetRegistration } from '../../domain/asset/index.ts';
import { createAsset, normalizeAssetTags } from '../../domain/asset/index.ts';
import {
  createImageAsset,
  createImageMetadata,
  type ImageAsset
} from '../../domain/image/index.ts';
import type { StorageProvider } from '../../domain/storage/index.ts';

export interface AssetLibraryOptions {
  storageProvider: StorageProvider;
}

export class AssetLibrary {
  private readonly storageProvider: StorageProvider;
  private readonly assets = new Map<string, Asset>();

  constructor(options: AssetLibraryOptions) {
    this.storageProvider = options.storageProvider;
  }

  async registerAsset(registration: AssetRegistration): Promise<Asset> {
    const storagePath = registration.storagePath ?? registration.filename;
    const storageMetadata = registration.content === undefined
      ? await this.storageProvider.getFileMetadata(storagePath)
      : await this.storageProvider.uploadFile({
          path: storagePath,
          content: registration.content,
          contentType: registration.mimeType,
          metadata: registration.metadata
        });
    const asset = createAsset({
      id: registration.id,
      filename: registration.filename,
      mimeType: registration.mimeType,
      size: storageMetadata?.size ?? 0,
      category: registration.category,
      tags: normalizeAssetTags(registration.tags),
      metadata: registration.metadata,
      storageReference: {
        provider: storageMetadata?.provider ?? this.storageProvider.name,
        path: storageMetadata?.path ?? storagePath,
        id: storageMetadata?.id,
        uri: registration.storageUri,
        metadata: storageMetadata?.metadata
      }
    });

    this.assets.set(asset.id, asset);
    return asset;
  }

  async findAsset(id: string): Promise<Asset | null> {
    return this.assets.get(id) ?? null;
  }

  async getAssetMetadata(id: string): Promise<Asset | null> {
    return this.findAsset(id);
  }

  async getAssetFile(id: string): Promise<AssetFile | null> {
    const asset = await this.findAsset(id);

    if (!asset) {
      return null;
    }

    const file = await this.storageProvider.downloadFile({
      path: asset.storageReference.path
    });

    return {
      asset: {
        ...asset,
        size: file.metadata.size,
        storageReference: {
          ...asset.storageReference,
          id: file.metadata.id,
          provider: file.metadata.provider ?? asset.storageReference.provider,
          metadata: file.metadata.metadata
        }
      },
      content: file.content
    };
  }

  async listAssets(): Promise<Asset[]> {
    return [...this.assets.values()];
  }

  async getImageAsset(id: string): Promise<ImageAsset | null> {
    const asset = await this.findAsset(id);
    return asset ? mapAssetToImageAsset(asset) : null;
  }
}

export function mapAssetToImageAsset(asset: Asset): ImageAsset {
  const width = getNumberMetadata(asset, 'width');
  const height = getNumberMetadata(asset, 'height');

  return createImageAsset({
    id: asset.id,
    uri: asset.storageReference.uri ?? asset.storageReference.path,
    metadata: createImageMetadata({
      filename: asset.filename,
      title: getStringMetadata(asset, 'title'),
      description: getStringMetadata(asset, 'description'),
      tags: asset.tags,
      category: asset.category,
      width,
      height,
      takenAt: getStringMetadata(asset, 'takenAt'),
      rating: getNumberMetadata(asset, 'rating'),
      favorite: getBooleanMetadata(asset, 'favorite'),
      checksum: getStringMetadata(asset, 'checksum'),
      source: {
        provider: asset.storageReference.provider,
        externalId: getStringMetadata(asset, 'driveFileId') ?? asset.storageReference.id,
        url: asset.storageReference.uri,
        metadata: {
          ...asset.metadata,
          assetId: asset.id,
          storagePath: asset.storageReference.path,
          ...asset.storageReference.metadata
        }
      }
    })
  });
}

function getStringMetadata(asset: Asset, key: string): string | undefined {
  const value = asset.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumberMetadata(asset: Asset, key: string): number | undefined {
  const value = asset.metadata?.[key];
  return typeof value === 'number' ? value : undefined;
}

function getBooleanMetadata(asset: Asset, key: string): boolean | undefined {
  const value = asset.metadata?.[key];
  return typeof value === 'boolean' ? value : undefined;
}
