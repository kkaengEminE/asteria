import type { ContentDraft, ImageAsset } from './types';
import type { MagazineConfig } from './MagazineConfig';

export interface ImageSelectionRequest {
  magazine: MagazineConfig;
  draft: ContentDraft;
  candidates: ImageAsset[];
  metadata?: Record<string, unknown>;
}

export interface ImageSelector {
  selectImage(request: ImageSelectionRequest): Promise<ImageAsset | null>;
}

