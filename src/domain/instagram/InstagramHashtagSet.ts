export interface InstagramHashtagSet {
  primary: string[];
  secondary: string[];
  branded: string[];
}

export function createInstagramHashtagSet(hashtagSet: InstagramHashtagSet): InstagramHashtagSet {
  return {
    primary: normalizeHashtags(hashtagSet.primary),
    secondary: normalizeHashtags(hashtagSet.secondary),
    branded: normalizeHashtags(hashtagSet.branded)
  };
}

export function normalizeHashtags(values: string[] = []): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const tag = toHashtag(value);

    if (!tag || seen.has(tag.toLowerCase())) {
      continue;
    }

    seen.add(tag.toLowerCase());
    normalized.push(tag);
  }

  return normalized;
}

function toHashtag(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  const compact = withoutHash.replace(/[^\p{L}\p{N}_]+/gu, '');

  return compact ? `#${compact}` : '';
}
