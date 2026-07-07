import type { ImageCategory } from './ImageCategory.ts';
import type { ImageTag } from './ImageTag.ts';
import { normalizeImageTags } from './ImageTag.ts';

export type ImageOrientation = 'landscape' | 'portrait' | 'square' | 'unknown';

export interface ImageSourceReference {
  provider: string;
  externalId?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface ImageMetadata {
  filename: string;
  title?: string;
  description?: string;
  tags: ImageTag[];
  category?: ImageCategory;
  width?: number;
  height?: number;
  orientation: ImageOrientation;
  takenAt?: string;
  rating?: number;
  favorite?: boolean;
  source?: ImageSourceReference;
  checksum?: string;
}

export class ImageMetadataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageMetadataValidationError';
  }
}

export function createImageMetadata(input: Omit<ImageMetadata, 'orientation' | 'tags'> & {
  tags?: string[];
  orientation?: ImageOrientation;
}): ImageMetadata {
  const metadata: ImageMetadata = {
    ...input,
    tags: normalizeImageTags(input.tags),
    orientation: input.orientation ?? inferOrientation(input.width, input.height)
  };

  validateImageMetadata(metadata);

  return metadata;
}

export function validateImageMetadata(metadata: ImageMetadata): void {
  if (!metadata.filename || metadata.filename.trim().length === 0) {
    throw new ImageMetadataValidationError('Image metadata requires filename.');
  }

  validatePositiveDimension(metadata.width, 'width');
  validatePositiveDimension(metadata.height, 'height');

  if (metadata.rating !== undefined && (metadata.rating < 0 || metadata.rating > 5)) {
    throw new ImageMetadataValidationError('Image metadata rating must be between 0 and 5.');
  }
}

export function inferOrientation(width?: number, height?: number): ImageOrientation {
  if (!width || !height) {
    return 'unknown';
  }

  if (width === height) {
    return 'square';
  }

  return width > height ? 'landscape' : 'portrait';
}

function validatePositiveDimension(value: number | undefined, field: 'width' | 'height'): void {
  if (value !== undefined && value <= 0) {
    throw new ImageMetadataValidationError(`Image metadata ${field} must be greater than 0.`);
  }
}

