import {
  createMonetizationPreview,
  createProduct,
  createRecommendation,
  createRecommendationReason,
  matchesProductSearchQuery,
  scoreProductForQuery,
  type AffiliateLink,
  type MonetizationProvider,
  type MonetizationResult,
  type Product,
  type ProductSearchQuery,
  type Recommendation
} from '../../../domain/monetization/index.ts';
import { createProviderToken } from '../../ProviderToken.ts';
import {
  validateCoupangAffiliateConfig,
  type CoupangAffiliateConfig
} from './CoupangAffiliateConfig.ts';
import type { CoupangAffiliateLinkResult } from './CoupangAffiliateLinkResult.ts';
import type { CoupangProductRecord } from './CoupangProductRecord.ts';

export const coupangAffiliateProviderToken = createProviderToken<MonetizationProvider>(
  'Affiliate',
  'coupang',
  'Mock-first Coupang affiliate adapter draft.'
);

export class CoupangAffiliateProvider implements MonetizationProvider {
  readonly name: string;
  private readonly products: Product[];

  constructor(config: CoupangAffiliateConfig) {
    validateCoupangAffiliateConfig(config);
    this.name = config.name ?? 'coupang';
    this.products = config.records.map(mapCoupangRecordToProduct);
  }

  async searchProducts(query: ProductSearchQuery): Promise<Product[]> {
    const matches = this.products
      .filter((product) => matchesProductSearchQuery(product, query))
      .sort((left, right) => scoreProductForQuery(right, query) - scoreProductForQuery(left, query));

    return typeof query.limit === 'number' ? matches.slice(0, query.limit) : matches;
  }

  async recommendProducts(query: ProductSearchQuery): Promise<Recommendation[]> {
    const products = await this.searchProducts(query);

    return Promise.all(
      products.map(async (product, index) => {
        const score = scoreProductForQuery(product, query);
        const affiliateLink = await this.generateAffiliateLink(product);

        return createRecommendation({
          product,
          reason: createRecommendationReason(
            'coupang-mock-match',
            `Matched "${query.topic ?? query.text ?? 'requested topic'}" with Coupang-style mock product metadata.`
          ),
          confidence: Math.min(1, score / 30),
          relatedTopic: query.topic ?? query.text,
          priority: index + 1,
          score,
          affiliateLink
        });
      })
    );
  }

  async generateAffiliateLink(product: Product): Promise<AffiliateLink> {
    const link: CoupangAffiliateLinkResult = {
      id: `mock-coupang-affiliate-${product.id}`,
      productId: product.id,
      provider: 'coupang',
      url: `mock://affiliate/coupang/${encodeURIComponent(product.id)}`,
      label: product.name,
      disclosure: 'Affiliate disclosure placeholder. No real Coupang Partners link was generated.',
      metadata: {
        dryRun: true,
        coupangProductId: getCoupangProductId(product),
        productionLink: false
      }
    };

    return link;
  }

  async previewRecommendation(topic: string, recommendations: Recommendation[]): Promise<MonetizationResult> {
    return createMonetizationPreview(topic, recommendations);
  }
}

export function mapCoupangRecordToProduct(record: CoupangProductRecord): Product {
  return createProduct({
    id: record.id,
    name: record.productName,
    description: record.productDescription,
    category: record.categoryName,
    tags: record.keywords,
    brand: record.brandName,
    price:
      typeof record.priceAmount === 'number'
        ? {
            amount: record.priceAmount,
            currency: record.currency ?? 'KRW'
          }
        : undefined,
    rating: record.rating,
    thumbnail: record.imageUrl ?? record.mockUri,
    url: record.productUrl ?? record.mockUri,
    provider: 'coupang',
    metadata: {
      dryRun: true,
      coupangProductId: record.coupangProductId
    }
  });
}

function getCoupangProductId(product: Product): string | undefined {
  const value = product.metadata?.coupangProductId;
  return typeof value === 'string' ? value : undefined;
}
