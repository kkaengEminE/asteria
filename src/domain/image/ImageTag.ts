export type ImageTag = string;

export function normalizeImageTag(tag: string): ImageTag {
  return tag.trim().toLowerCase();
}

export function normalizeImageTags(tags: string[] = []): ImageTag[] {
  return [...new Set(tags.map(normalizeImageTag).filter(Boolean))].sort();
}

export function hasAllImageTags(candidateTags: ImageTag[] = [], requiredTags: ImageTag[] = []): boolean {
  const candidateSet = new Set(candidateTags.map(normalizeImageTag));

  return requiredTags.every((tag) => candidateSet.has(normalizeImageTag(tag)));
}

