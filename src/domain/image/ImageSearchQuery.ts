import type { ImageAsset } from './ImageAsset.ts';
import type { ImageSelectionCriteria } from './ImageSelectionCriteria.ts';
import { hasAllImageTags, normalizeImageTags } from './ImageTag.ts';

export interface ImageSearchQuery {
  text?: string;
  criteria?: ImageSelectionCriteria;
  limit?: number;
}

export interface ImageDomainLibrary {
  search(query: ImageSearchQuery): Promise<ImageAsset[]>;
  find(id: string): Promise<ImageAsset | null>;
  random(query?: ImageSearchQuery): Promise<ImageAsset | null>;
  score(asset: ImageAsset, criteria: ImageSelectionCriteria): Promise<number>;
  select(candidates: ImageAsset[], criteria: ImageSelectionCriteria): Promise<ImageAsset | null>;
}

export function matchesImageSearchQuery(asset: ImageAsset, query: ImageSearchQuery): boolean {
  const criteria = query.criteria;

  if (query.text && !matchesText(asset, query.text)) {
    return false;
  }

  if (!criteria) {
    return true;
  }

  if (criteria.tags && !hasAllImageTags(asset.metadata.tags, normalizeImageTags(criteria.tags))) {
    return false;
  }

  if (criteria.category && asset.metadata.category !== criteria.category) {
    return false;
  }

  if (criteria.minimumRating !== undefined && (asset.metadata.rating ?? 0) < criteria.minimumRating) {
    return false;
  }

  if (criteria.favoriteOnly && asset.metadata.favorite !== true) {
    return false;
  }

  if (criteria.orientation && criteria.orientation !== 'unknown' && asset.metadata.orientation !== criteria.orientation) {
    return false;
  }

  if (
    criteria.aspectRatio &&
    criteria.aspectRatio !== 'any' &&
    asset.metadata.orientation !== criteria.aspectRatio
  ) {
    return false;
  }

  return true;
}

function matchesText(asset: ImageAsset, text: string): boolean {
  const haystack = [
    asset.metadata.filename,
    asset.metadata.title,
    asset.metadata.description,
    asset.metadata.category,
    ...asset.metadata.tags
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(text.toLowerCase());
}

