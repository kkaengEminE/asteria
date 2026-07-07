import type { ImageAsset } from './types';

export interface ImageSearchRequest {
  query: string;
  tags?: string[];
  limit?: number;
  metadata?: Record<string, unknown>;
}

export interface ImageLibrary {
  readonly name: string;
  findImages(request: ImageSearchRequest): Promise<ImageAsset[]>;
}

