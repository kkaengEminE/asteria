export interface ProductPrice {
  amount: number;
  currency: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags: string[];
  brand?: string;
  price?: ProductPrice;
  rating?: number;
  thumbnail?: string;
  url?: string;
  provider: string;
  metadata?: Record<string, unknown>;
}

export class ProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductValidationError';
  }
}

export function createProduct(product: Product): Product {
  validateProduct(product);

  return {
    ...product,
    tags: normalizeProductTags(product.tags)
  };
}

export function validateProduct(product: Product): void {
  if (!product.id || product.id.trim().length === 0) {
    throw new ProductValidationError('Product requires id.');
  }

  if (!product.name || product.name.trim().length === 0) {
    throw new ProductValidationError('Product requires name.');
  }

  if (!product.provider || product.provider.trim().length === 0) {
    throw new ProductValidationError('Product requires provider.');
  }

  if (product.price && product.price.amount < 0) {
    throw new ProductValidationError('Product price amount cannot be negative.');
  }

  if (product.price && product.price.currency.trim().length === 0) {
    throw new ProductValidationError('Product price requires currency.');
  }

  if (product.rating !== undefined && (product.rating < 0 || product.rating > 5)) {
    throw new ProductValidationError('Product rating must be between 0 and 5.');
  }
}

export function normalizeProductTags(tags: string[] = []): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].sort();
}

