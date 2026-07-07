import type { ImageMetadata } from './ImageMetadata.ts';
import { validateImageMetadata } from './ImageMetadata.ts';

export interface ImageAsset {
  id: string;
  uri: string;
  metadata: ImageMetadata;
}

export class ImageAssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageAssetValidationError';
  }
}

export function createImageAsset(asset: ImageAsset): ImageAsset {
  validateImageAsset(asset);
  return asset;
}

export function validateImageAsset(asset: ImageAsset): void {
  if (!asset.id || asset.id.trim().length === 0) {
    throw new ImageAssetValidationError('Image asset requires id.');
  }

  if (!asset.uri || asset.uri.trim().length === 0) {
    throw new ImageAssetValidationError('Image asset requires uri.');
  }

  validateImageMetadata(asset.metadata);
}

