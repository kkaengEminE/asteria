import type { Product } from './Product.ts';

export interface AffiliateLink {
  id: string;
  productId: string;
  provider: string;
  url: string;
  label: string;
  disclosure: string;
  metadata?: Record<string, unknown>;
}

export class AffiliateLinkValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AffiliateLinkValidationError';
  }
}

export function createMockAffiliateLink(product: Product): AffiliateLink {
  const link: AffiliateLink = {
    id: `mock-affiliate-${product.id}`,
    productId: product.id,
    provider: product.provider,
    url: `mock://affiliate/${encodeURIComponent(product.provider)}/${encodeURIComponent(product.id)}`,
    label: product.name,
    disclosure: 'Affiliate disclosure placeholder. No real affiliate network was used.',
    metadata: {
      dryRun: true
    }
  };

  validateAffiliateLink(link);

  return link;
}

export function validateAffiliateLink(link: AffiliateLink): void {
  if (!link.id || link.id.trim().length === 0) {
    throw new AffiliateLinkValidationError('Affiliate link requires id.');
  }

  if (!link.productId || link.productId.trim().length === 0) {
    throw new AffiliateLinkValidationError('Affiliate link requires productId.');
  }

  if (!link.provider || link.provider.trim().length === 0) {
    throw new AffiliateLinkValidationError('Affiliate link requires provider.');
  }

  if (!link.url || link.url.trim().length === 0) {
    throw new AffiliateLinkValidationError('Affiliate link requires url.');
  }
}

