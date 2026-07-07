import type { Product } from './Product.ts';
import { normalizeProductTags } from './Product.ts';

export interface ProductSearchQuery {
  text?: string;
  topic?: string;
  category?: string;
  tags?: string[];
  minimumRating?: number;
  limit?: number;
}

export function matchesProductSearchQuery(product: Product, query: ProductSearchQuery): boolean {
  if (query.text && !productMatchesText(product, query.text)) {
    return false;
  }

  if (query.topic && !productMatchesText(product, query.topic)) {
    return false;
  }

  if (query.category && product.category !== query.category) {
    return false;
  }

  if (query.tags && !hasAllTags(product.tags, query.tags)) {
    return false;
  }

  if (query.minimumRating !== undefined && (product.rating ?? 0) < query.minimumRating) {
    return false;
  }

  return true;
}

export function scoreProductForQuery(product: Product, query: ProductSearchQuery): number {
  let score = 0;

  if (query.topic && productMatchesText(product, query.topic)) {
    score += 10;
  }

  if (query.text && productMatchesText(product, query.text)) {
    score += 8;
  }

  if (query.category && product.category === query.category) {
    score += 6;
  }

  if (query.tags) {
    const normalizedTags = normalizeProductTags(query.tags);
    score += normalizedTags.filter((tag) => product.tags.includes(tag)).length * 5;
  }

  if (query.minimumRating !== undefined && (product.rating ?? 0) >= query.minimumRating) {
    score += product.rating ?? 0;
  }

  return score;
}

function productMatchesText(product: Product, text: string): boolean {
  const haystack = [
    product.name,
    product.description,
    product.category,
    product.brand,
    ...product.tags
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(text.toLowerCase());
}

function hasAllTags(productTags: string[] = [], requiredTags: string[] = []): boolean {
  const normalizedProductTags = new Set(normalizeProductTags(productTags));
  return normalizeProductTags(requiredTags).every((tag) => normalizedProductTags.has(tag));
}

