import {
  createMonetizationPreview,
  createProduct,
  createRecommendation,
  createRecommendationReason,
  matchesProductSearchQuery,
  scoreProductForQuery,
  type AffiliateLink,
  type MonetizationProvider,
  type MonetizationProviderDiagnostics,
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
import { CoupangFetchAffiliateTransport, type CoupangAffiliateTransport } from './CoupangAffiliateTransport.ts';
import type { CoupangAffiliateLinkResult } from './CoupangAffiliateLinkResult.ts';
import type { CoupangProductRecord } from './CoupangProductRecord.ts';
import { RetryService } from '../../../services/retry/index.ts';

export const coupangAffiliateProviderToken = createProviderToken<MonetizationProvider>(
  'Affiliate',
  'coupang',
  'Mock-first Coupang affiliate adapter draft.'
);

export class CoupangAffiliateProvider implements MonetizationProvider {
  readonly name: string;
  private products: Product[];
  private readonly dryRun: boolean;
  private readonly enabled: boolean;
  private readonly accessKey?: string;
  private readonly secretKey?: string;
  private readonly partnerId?: string;
  private readonly baseUrl: string;
  private readonly transport: CoupangAffiliateTransport;
  private readonly retryService: RetryService;
  private readonly auditLog?: CoupangAffiliateConfig['auditLog'];
  private requestCount = 0;
  private retryCount = 0;
  private returnedProductCount = 0;
  private failureReason?: string;

  constructor(config: CoupangAffiliateConfig) {
    validateCoupangAffiliateConfig(config);
    this.name = config.name ?? 'coupang';
    this.dryRun = config.dryRun !== false;
    this.enabled = config.enabled === true;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.partnerId = config.partnerId;
    this.baseUrl = config.baseUrl ?? 'https://api-gateway.coupang.com';
    this.transport = config.transport ?? new CoupangFetchAffiliateTransport();
    this.retryService = config.retryService ?? new RetryService();
    this.auditLog = config.auditLog;
    this.products = (config.records ?? []).map((record) => mapCoupangRecordToProduct(record));
  }

  async searchProducts(query: ProductSearchQuery): Promise<Product[]> {
    if (!this.dryRun) {
      return this.searchProductionProducts(query);
    }

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
    if (!this.dryRun) {
      return this.generateProductionAffiliateLink(product);
    }

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

  getDiagnostics(): MonetizationProviderDiagnostics {
    return {
      provider: this.name,
      productionEnabled: !this.dryRun && this.enabled,
      requestCount: this.requestCount,
      retryCount: this.retryCount,
      returnedProductCount: this.returnedProductCount,
      failureReason: this.failureReason
    };
  }

  private async searchProductionProducts(query: ProductSearchQuery): Promise<Product[]> {
    this.auditLog?.append({
      type: 'AFFILIATE_REQUEST_STARTED',
      actor: createAffiliateActor(this.name),
      context: createAffiliateAuditContext(query),
      message: 'Coupang product search started.',
      metadata: {
        provider: this.name,
        requestType: 'searchProducts'
      }
    });

    const retryResult = await this.retryService.execute(
      async () => {
        this.requestCount += 1;

        const response = await this.transport.searchProducts({
          accessKey: this.accessKey!,
          secretKey: this.secretKey!,
          partnerId: this.partnerId!,
          baseUrl: this.baseUrl,
          query
        });

        return response.products.map((record) => mapCoupangRecordToProduct(record, { dryRun: false }));
      },
      {
        policy: {
          maxAttempts: 2,
          delayMs: 25
        }
      }
    );

    this.retryCount += retryResult.retryCount;

    if (retryResult.status !== 'success') {
      this.failureReason = retryResult.finalReason?.message ?? 'Coupang product search failed.';
      this.auditLog?.append({
        type: 'AFFILIATE_REQUEST_FAILED',
        actor: createAffiliateActor(this.name),
        context: createAffiliateAuditContext(query),
        message: this.failureReason,
        metadata: {
          provider: this.name,
          requestType: 'searchProducts',
          retryCount: retryResult.retryCount,
          failureCode: retryResult.finalReason?.code
        }
      });
      throw new Error(this.failureReason);
    }

    const retryProducts = retryResult.value ?? [];
    const products = typeof query.limit === 'number' ? retryProducts.slice(0, query.limit) : retryProducts;

    this.products = products;
    this.returnedProductCount = products.length;
    this.failureReason = undefined;
    this.auditLog?.append({
      type: 'AFFILIATE_REQUEST_SUCCEEDED',
      actor: createAffiliateActor(this.name),
      context: createAffiliateAuditContext(query),
      message: `Coupang product search returned ${products.length} products.`,
      metadata: {
        provider: this.name,
        requestType: 'searchProducts',
        returnedProductCount: products.length,
        retryCount: retryResult.retryCount
      }
    });

    return products;
  }

  private async generateProductionAffiliateLink(product: Product): Promise<AffiliateLink> {
    const retryResult = await this.retryService.execute(
      async () => {
        this.requestCount += 1;

        return this.transport.generateAffiliateLink({
          accessKey: this.accessKey!,
          secretKey: this.secretKey!,
          partnerId: this.partnerId!,
          baseUrl: this.baseUrl,
          productId: product.id,
          productUrl: product.url
        });
      },
      {
        policy: {
          maxAttempts: 2,
          delayMs: 25
        }
      }
    );

    this.retryCount += retryResult.retryCount;

    if (retryResult.status !== 'success') {
      this.failureReason = retryResult.finalReason?.message ?? 'Coupang affiliate link request failed.';
      throw new Error(this.failureReason);
    }

    if (!retryResult.value?.url) {
      this.failureReason = 'Coupang affiliate link response did not include a URL.';
      throw new Error(this.failureReason);
    }

    return {
      id: `coupang-affiliate-${product.id}`,
      productId: product.id,
      provider: 'coupang',
      url: retryResult.value.url,
      label: product.name,
      disclosure: 'Affiliate disclosure required. Coupang Partners link generated in production mode.',
      metadata: {
        dryRun: false,
        productionLink: true,
        coupangProductId: getCoupangProductId(product)
      }
    };
  }
}

export function mapCoupangRecordToProduct(record: CoupangProductRecord, options: { dryRun?: boolean } = {}): Product {
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
      dryRun: options.dryRun ?? true,
      coupangProductId: record.coupangProductId
    }
  });
}

function getCoupangProductId(product: Product): string | undefined {
  const value = product.metadata?.coupangProductId;
  return typeof value === 'string' ? value : undefined;
}

function createAffiliateActor(provider: string) {
  return {
    type: 'service' as const,
    id: provider,
    name: provider
  };
}

function createAffiliateAuditContext(query: ProductSearchQuery) {
  return {
    entityType: 'affiliateRequest',
    topic: query.topic ?? query.text,
    metadata: {
      category: query.category,
      tags: query.tags
    }
  };
}
