export interface AssetStorageReference {
  provider: string;
  path: string;
  id?: string;
  uri?: string;
  metadata?: Record<string, unknown>;
}

export interface Asset {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  category?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  storageReference: AssetStorageReference;
}

export class AssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssetValidationError';
  }
}

export function createAsset(asset: Asset): Asset {
  validateAsset(asset);

  return {
    ...asset,
    tags: normalizeAssetTags(asset.tags)
  };
}

export function validateAsset(asset: Asset): void {
  if (!asset.id || asset.id.trim().length === 0) {
    throw new AssetValidationError('Asset requires id.');
  }

  if (!asset.filename || asset.filename.trim().length === 0) {
    throw new AssetValidationError('Asset requires filename.');
  }

  if (!asset.mimeType || asset.mimeType.trim().length === 0) {
    throw new AssetValidationError('Asset requires mimeType.');
  }

  if (asset.size < 0) {
    throw new AssetValidationError('Asset size must be zero or greater.');
  }

  if (!asset.storageReference.provider || asset.storageReference.provider.trim().length === 0) {
    throw new AssetValidationError('Asset storage reference requires provider.');
  }

  if (!asset.storageReference.path || asset.storageReference.path.trim().length === 0) {
    throw new AssetValidationError('Asset storage reference requires path.');
  }
}

export function normalizeAssetTags(tags: string[] = []): string[] {
  return [...new Set(
    tags
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0)
  )].sort();
}
