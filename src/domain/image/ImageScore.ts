import type { ImageAsset } from './ImageAsset.ts';
import type { ImageSelectionCriteria } from './ImageSelectionCriteria.ts';
import { hasAllImageTags, normalizeImageTags } from './ImageTag.ts';

export interface ImageScore {
  assetId: string;
  score: number;
  reasons: string[];
}

export function scoreImageAsset(asset: ImageAsset, criteria: ImageSelectionCriteria): ImageScore {
  let score = 0;
  const reasons: string[] = [];
  const requiredTags = normalizeImageTags(criteria.tags);

  if (requiredTags.length > 0 && hasAllImageTags(asset.metadata.tags, requiredTags)) {
    score += requiredTags.length * 10;
    reasons.push('matched required tags');
  }

  if (criteria.category && asset.metadata.category === criteria.category) {
    score += 8;
    reasons.push('matched category');
  }

  if (criteria.aspectRatio && criteria.aspectRatio !== 'any' && asset.metadata.orientation === criteria.aspectRatio) {
    score += 6;
    reasons.push('matched aspect ratio');
  }

  if (criteria.orientation && asset.metadata.orientation === criteria.orientation) {
    score += 6;
    reasons.push('matched orientation');
  }

  if (criteria.minimumRating !== undefined && (asset.metadata.rating ?? 0) >= criteria.minimumRating) {
    score += asset.metadata.rating ?? 0;
    reasons.push('met minimum rating');
  }

  if (asset.metadata.favorite) {
    score += 3;
    reasons.push('favorite image');
  }

  if (criteria.topic && textIncludes(asset, criteria.topic)) {
    score += 5;
    reasons.push('matched topic text');
  }

  if (criteria.mood && textIncludes(asset, criteria.mood)) {
    score += 4;
    reasons.push('matched mood text');
  }

  if (criteria.randomWeight && criteria.randomWeight > 0) {
    const stableWeight = stableNumber(asset.id) * criteria.randomWeight;
    score += stableWeight;
    reasons.push('applied stable random weight');
  }

  return {
    assetId: asset.id,
    score,
    reasons
  };
}

export function selectHighestScoredImage(
  candidates: ImageAsset[],
  criteria: ImageSelectionCriteria
): ImageAsset | null {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const rightScore = scoreImageAsset(right, criteria).score;
    const leftScore = scoreImageAsset(left, criteria).score;

    return rightScore - leftScore || left.id.localeCompare(right.id);
  })[0] ?? null;
}

function textIncludes(asset: ImageAsset, value: string): boolean {
  const text = [
    asset.metadata.filename,
    asset.metadata.title,
    asset.metadata.description,
    asset.metadata.category,
    ...asset.metadata.tags
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(value.toLowerCase());
}

function stableNumber(value: string): number {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1000;
  }

  return hash / 1000;
}

