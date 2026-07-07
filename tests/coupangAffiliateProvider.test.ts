import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProviderRegistry } from '../src/providers/index.ts';
import {
  CoupangAffiliateProvider,
  coupangAffiliateProviderToken,
  mapCoupangRecordToProduct,
  type CoupangProductRecord
} from '../src/providers/monetization/coupang/index.ts';

test('maps Coupang records to Product', () => {
  const product = mapCoupangRecordToProduct(mockRecords[0]);

  assert.equal(product.id, 'cat-puzzle-feeder');
  assert.equal(product.name, 'Cat Puzzle Feeder');
  assert.equal(product.category, 'cat-care');
  assert.deepEqual(product.tags, ['cat', 'enrichment', 'food', 'puzzle']);
  assert.equal(product.price?.currency, 'KRW');
  assert.equal(product.provider, 'coupang');
  assert.equal(product.metadata?.coupangProductId, 'coupang-product-cat-puzzle-feeder');
});

test('coupang affiliate provider searches by tag and category', async () => {
  const provider = createProvider();
  const products = await provider.searchProducts({
    category: 'cat-care',
    tags: ['cat', 'enrichment', 'food'],
    minimumRating: 4
  });

  assert.deepEqual(
    products.map((product) => product.id),
    ['cat-puzzle-feeder']
  );
});

test('coupang affiliate provider returns ranked recommendations', async () => {
  const provider = createProvider();
  const recommendations = await provider.recommendProducts({
    topic: 'cat enrichment',
    tags: ['cat', 'enrichment'],
    minimumRating: 4
  });

  assert.equal(recommendations.length, 2);
  assert.equal(recommendations[0].product.id, 'cat-puzzle-feeder');
  assert.ok(recommendations[0].score >= recommendations[1].score);
  assert.equal(recommendations[0].affiliateLink?.provider, 'coupang');
});

test('coupang affiliate provider generates mock affiliate link only', async () => {
  const provider = createProvider();
  const product = mapCoupangRecordToProduct(mockRecords[0]);
  const link = await provider.generateAffiliateLink(product);

  assert.equal(link.productId, product.id);
  assert.match(link.url, /^mock:\/\/affiliate\/coupang\//);
  assert.equal(link.metadata?.dryRun, true);
  assert.equal(link.metadata?.productionLink, false);
});

test('coupang affiliate provider can be registered and resolved', async () => {
  const registry = new ProviderRegistry();

  registry.register(
    coupangAffiliateProviderToken,
    () =>
      new CoupangAffiliateProvider({
        dryRun: true,
        records: mockRecords
      })
  );

  const provider = await registry.resolve(coupangAffiliateProviderToken, { dryRun: true });
  const products = await provider.searchProducts({
    tags: ['health'],
    minimumRating: 4
  });

  assert.equal(provider.name, 'coupang');
  assert.equal(products[0].id, 'cat-health-snack');
});

test('coupang affiliate provider makes no external api call', async () => {
  const provider = createProvider();
  const recommendations = await provider.recommendProducts({
    topic: 'cat enrichment',
    tags: ['cat']
  });
  const preview = await provider.previewRecommendation('cat enrichment', recommendations);

  assert.equal(preview.metadata?.dryRun, true);
  assert.match(preview.preview, /Cat Puzzle Feeder/);
  assert.ok(recommendations.every((recommendation) => recommendation.affiliateLink?.url.startsWith('mock://')));
});

function createProvider(): CoupangAffiliateProvider {
  return new CoupangAffiliateProvider({
    dryRun: true,
    records: mockRecords
  });
}

const mockRecords: CoupangProductRecord[] = [
  {
    id: 'cat-puzzle-feeder',
    productName: 'Cat Puzzle Feeder',
    productDescription: 'Mock Coupang-style enrichment feeder for indoor cats.',
    categoryName: 'cat-care',
    keywords: ['cat', 'enrichment', 'food', 'puzzle'],
    brandName: 'Mock Coupang Brand',
    priceAmount: 28900,
    currency: 'KRW',
    rating: 4.8,
    imageUrl: 'mock://coupang/images/cat-puzzle-feeder.jpg',
    productUrl: 'mock://coupang/products/cat-puzzle-feeder',
    coupangProductId: 'coupang-product-cat-puzzle-feeder',
    mockUri: 'mock://coupang/products/cat-puzzle-feeder'
  },
  {
    id: 'cat-health-snack',
    productName: 'Cat Health Snack',
    productDescription: 'Mock wellness snack listing for cat health content.',
    categoryName: 'cat-care',
    keywords: ['cat', 'health', 'snack'],
    priceAmount: 15900,
    currency: 'KRW',
    rating: 4.4,
    coupangProductId: 'coupang-product-cat-health-snack',
    mockUri: 'mock://coupang/products/cat-health-snack'
  },
  {
    id: 'dog-leash',
    productName: 'Dog Leash',
    productDescription: 'Mock dog walking product.',
    categoryName: 'dog-care',
    keywords: ['dog', 'walking'],
    priceAmount: 9900,
    currency: 'KRW',
    rating: 4.1,
    coupangProductId: 'coupang-product-dog-leash',
    mockUri: 'mock://coupang/products/dog-leash'
  },
  {
    id: 'cat-window-perch',
    productName: 'Cat Window Perch',
    productDescription: 'Mock perch for indoor window enrichment.',
    categoryName: 'cat-care',
    keywords: ['cat', 'enrichment', 'window'],
    priceAmount: 33900,
    currency: 'KRW',
    rating: 4.2,
    coupangProductId: 'coupang-product-cat-window-perch',
    mockUri: 'mock://coupang/products/cat-window-perch'
  }
];
