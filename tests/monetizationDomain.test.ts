import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProviderToken, ProviderRegistry } from '../src/providers/index.ts';
import {
  createProduct,
  MockMonetizationProvider,
  ProductValidationError
} from '../src/domain/monetization/index.ts';
import type { MonetizationProvider, Product } from '../src/domain/monetization/index.ts';

const monetizationProviderToken = createProviderToken<MonetizationProvider>(
  'Affiliate',
  'mock-monetization',
  'Mock monetization provider for domain tests.'
);

test('product validation normalizes tags', () => {
  const product = createProduct({
    id: 'cat-toy',
    name: 'Cat Toy',
    description: 'Interactive toy for indoor cats.',
    category: 'cat-care',
    tags: ['Cat', ' Toy ', 'cat'],
    provider: 'mock-provider',
    price: {
      amount: 12.99,
      currency: 'USD'
    },
    rating: 4.5
  });

  assert.deepEqual(product.tags, ['cat', 'toy']);
});

test('product validation rejects missing name', () => {
  assert.throws(
    () =>
      createProduct({
        id: 'missing-name',
        name: '',
        tags: [],
        provider: 'mock-provider'
      }),
    ProductValidationError
  );
});

test('mock monetization provider generates recommendations', async () => {
  const provider = createMockProvider();
  const recommendations = await provider.recommendProducts({
    topic: 'cat enrichment',
    tags: ['cat', 'enrichment'],
    minimumRating: 4
  });

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].product.id, 'cat-puzzle-toy');
  assert.ok(recommendations[0].confidence > 0);
  assert.equal(recommendations[0].affiliateLink?.url, 'mock://affiliate/mock-provider/cat-puzzle-toy');
});

test('mock affiliate link generation returns dry-run link', async () => {
  const provider = createMockProvider();
  const product = mockProducts[0];
  const link = await provider.generateAffiliateLink(product);

  assert.equal(link.productId, product.id);
  assert.equal(link.metadata?.dryRun, true);
  assert.match(link.url, /^mock:\/\/affiliate\//);
});

test('monetization provider can be registered and resolved', async () => {
  const registry = new ProviderRegistry();

  registry.register(monetizationProviderToken, () => createMockProvider());

  const provider = await registry.resolve(monetizationProviderToken, { dryRun: true });
  const products = await provider.searchProducts({
    tags: ['health'],
    minimumRating: 4
  });

  assert.equal(provider.name, 'mock-monetization');
  assert.equal(products[0].id, 'cat-health-supplement');
});

test('monetization preview generation summarizes recommendations', async () => {
  const provider = createMockProvider();
  const recommendations = await provider.recommendProducts({
    topic: 'cat enrichment',
    tags: ['cat', 'enrichment']
  });
  const preview = await provider.previewRecommendation('cat enrichment', recommendations);

  assert.equal(preview.topic, 'cat enrichment');
  assert.equal(preview.metadata?.dryRun, true);
  assert.match(preview.preview, /Cat Puzzle Toy/);
});

function createMockProvider(): MockMonetizationProvider {
  return new MockMonetizationProvider({
    products: mockProducts
  });
}

const mockProducts: Product[] = [
  {
    id: 'cat-puzzle-toy',
    name: 'Cat Puzzle Toy',
    description: 'Indoor enrichment toy for curious cats.',
    category: 'cat-care',
    tags: ['cat', 'enrichment', 'toy'],
    brand: 'Mock Brand',
    provider: 'mock-provider',
    price: {
      amount: 19.99,
      currency: 'USD'
    },
    rating: 4.8,
    thumbnail: 'mock://products/cat-puzzle-toy.jpg',
    url: 'mock://products/cat-puzzle-toy'
  },
  {
    id: 'cat-health-supplement',
    name: 'Cat Health Supplement',
    description: 'Mock supplement listing for wellness content.',
    category: 'cat-care',
    tags: ['cat', 'health'],
    provider: 'mock-provider',
    price: {
      amount: 24.99,
      currency: 'USD'
    },
    rating: 4.2
  }
];

