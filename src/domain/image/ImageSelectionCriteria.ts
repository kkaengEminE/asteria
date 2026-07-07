import type { ImageCategory } from './ImageCategory.ts';
import type { ImageOrientation } from './ImageMetadata.ts';
import type { ImageTag } from './ImageTag.ts';

export type ImageAspectRatio = 'landscape' | 'portrait' | 'square' | 'any';

export interface ImageSelectionCriteria {
  topic?: string;
  mood?: string;
  tags?: ImageTag[];
  category?: ImageCategory;
  minimumRating?: number;
  aspectRatio?: ImageAspectRatio;
  orientation?: ImageOrientation;
  randomWeight?: number;
  favoriteOnly?: boolean;
}

