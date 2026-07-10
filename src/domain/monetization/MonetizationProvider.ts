import type { AffiliateLink } from './AffiliateLink.ts';
import { createMockAffiliateLink } from './AffiliateLink.ts';
import type { MonetizationResult } from './MonetizationResult.ts';
import { createMonetizationPreview } from './MonetizationResult.ts';
import type { Product } from './Product.ts';
import { createProduct } from './Product.ts';
import type { ProductSearchQuery } from './ProductSearchQuery.ts';
import { matchesProductSearchQuery, scoreProductForQuery } from './ProductSearchQuery.ts';
import type { Recommendation } from './Recommendation.ts';
import { createRecommendation } from './Recommendation.ts';
import { createRecommendationReason } from './RecommendationReason.ts';

export interface MonetizationProvider {
  readonly name: string;
  searchProducts(query: ProductSearchQuery): Promise<Product[]>;
  recommendProducts(query: ProductSearchQuery): Promise<Recommendation[]>;
  generateAffiliateLink(product: Product): Promise<AffiliateLink>;
  previewRecommendation(topic: string, recommendations: Recommendation[]): Promise<MonetizationResult>;
  getDiagnostics?(): MonetizationProviderDiagnostics;
}

export interface MonetizationProviderDiagnostics {
  provider: string;
  productionEnabled?: boolean;
  requestCount: number;
  retryCount: number;
  returnedProductCount: number;
  failureReason?: string;
}

export interface MockMonetizationProviderOptions {
  name?: string;
  products: Product[];
}

export class MockMonetizationProvider implements MonetizationProvider {
  readonly name: string;
  private readonly products: Product[];
  private returnedProductCount = 0;

  constructor(options: MockMonetizationProviderOptions) {
    this.name = options.name ?? 'mock-monetization';
    this.products = options.products.map(createProduct);
  }

  async searchProducts(query: ProductSearchQuery): Promise<Product[]> {
    const matches = this.products
      .filter((product) => matchesProductSearchQuery(product, query))
      .sort((left, right) => scoreProductForQuery(right, query) - scoreProductForQuery(left, query));

    const products = typeof query.limit === 'number' ? matches.slice(0, query.limit) : matches;

    this.returnedProductCount = products.length;

    return products;
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
            'mock-topic-match',
            `Matched "${query.topic ?? query.text ?? 'requested topic'}" with provider-agnostic product metadata.`
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
    return createMockAffiliateLink(product);
  }

  async previewRecommendation(topic: string, recommendations: Recommendation[]): Promise<MonetizationResult> {
    return createMonetizationPreview(topic, recommendations);
  }

  getDiagnostics(): MonetizationProviderDiagnostics {
    return {
      provider: this.name,
      productionEnabled: false,
      requestCount: 0,
      retryCount: 0,
      returnedProductCount: this.returnedProductCount
    };
  }
}
