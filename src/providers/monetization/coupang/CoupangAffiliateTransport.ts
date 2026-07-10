import { createHmac } from 'node:crypto';
import type { ProductSearchQuery } from '../../../domain/monetization/index.ts';
import type { CoupangProductSearchResponse } from './CoupangProductRecord.ts';

export interface CoupangAffiliateTransportRequest {
  accessKey: string;
  secretKey: string;
  partnerId: string;
  baseUrl: string;
  query: ProductSearchQuery;
}

export interface CoupangAffiliateLinkTransportRequest {
  accessKey: string;
  secretKey: string;
  partnerId: string;
  baseUrl: string;
  productId: string;
  productUrl?: string;
}

export interface CoupangAffiliateLinkTransportResponse {
  url: string;
}

export interface CoupangAffiliateTransport {
  searchProducts(request: CoupangAffiliateTransportRequest): Promise<CoupangProductSearchResponse>;
  generateAffiliateLink(request: CoupangAffiliateLinkTransportRequest): Promise<CoupangAffiliateLinkTransportResponse>;
}

export class CoupangFetchAffiliateTransport implements CoupangAffiliateTransport {
  async searchProducts(request: CoupangAffiliateTransportRequest): Promise<CoupangProductSearchResponse> {
    const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search';
    const response = await fetch(`${request.baseUrl}${path}`, {
      method: 'POST',
      headers: createCoupangHeaders(request, 'POST', path),
      body: JSON.stringify({
        keyword: request.query.topic ?? request.query.text ?? request.query.tags?.join(' ') ?? '',
        category: request.query.category,
        limit: request.query.limit
      })
    });

    return mapSearchResponse(response);
  }

  async generateAffiliateLink(request: CoupangAffiliateLinkTransportRequest): Promise<CoupangAffiliateLinkTransportResponse> {
    const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
    const response = await fetch(`${request.baseUrl}${path}`, {
      method: 'POST',
      headers: createCoupangHeaders(request, 'POST', path),
      body: JSON.stringify({
        coupangUrls: [request.productUrl ?? request.productId]
      })
    });
    const body = await response.json() as {
      data?: Array<{ shortenUrl?: string; landingUrl?: string }>;
    };

    if (!response.ok) {
      throw new Error(`Coupang affiliate link request failed with status ${response.status}.`);
    }

    const url = body.data?.[0]?.shortenUrl ?? body.data?.[0]?.landingUrl;

    if (!url) {
      throw new Error('Coupang affiliate link response did not include a URL.');
    }

    return { url };
  }
}

function createCoupangHeaders(
  request: { accessKey: string; secretKey: string },
  method: string,
  path: string
): Record<string, string> {
  const signedDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const signature = createHmac('sha256', request.secretKey)
    .update(`${signedDate}${method}${path}`)
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    Authorization: `CEA algorithm=HmacSHA256, access-key=${request.accessKey}, signed-date=${signedDate}, signature=${signature}`
  };
}

async function mapSearchResponse(response: Response): Promise<CoupangProductSearchResponse> {
  const body = await response.json() as {
    products?: unknown;
    data?: { products?: unknown };
  };

  if (!response.ok) {
    throw new Error(`Coupang product search failed with status ${response.status}.`);
  }

  const products = Array.isArray(body.products)
    ? body.products
    : Array.isArray(body.data?.products)
      ? body.data.products
      : [];

  return {
    products: products as CoupangProductSearchResponse['products']
  };
}
