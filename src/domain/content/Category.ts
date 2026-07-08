import { normalizeLabel, slugify } from './Tag.ts';

export interface Category {
  name: string;
  slug: string;
  parentSlug?: string;
}

export function createCategory(name: string, parentSlug?: string): Category {
  const normalizedName = normalizeLabel(name);

  return {
    name: normalizedName,
    slug: slugify(normalizedName),
    parentSlug
  };
}

