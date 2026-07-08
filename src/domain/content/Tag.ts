export interface Tag {
  name: string;
  slug: string;
}

export function createTag(name: string): Tag {
  const normalizedName = normalizeLabel(name);

  return {
    name: normalizedName,
    slug: slugify(normalizedName)
  };
}

export function normalizeTags(tags: Array<string | Tag> = []): Tag[] {
  const normalized = tags.map((tag) => (typeof tag === 'string' ? createTag(tag) : createTag(tag.name)));
  const bySlug = new Map(normalized.map((tag) => [tag.slug, tag]));

  return [...bySlug.values()].sort((left, right) => left.slug.localeCompare(right.slug));
}

export function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'untitled';
}

