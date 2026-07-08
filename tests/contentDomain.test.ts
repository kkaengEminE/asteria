import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ArticleValidationError,
  FAQValidationError,
  SEOValidationError,
  createArticle,
  createCategory,
  createContentGenerationResult,
  createFAQ,
  createSEO,
  normalizeContentMetadata,
  normalizeTags,
  slugify
} from '../src/domain/content/index.ts';

test('article validation creates a normalized article', () => {
  const article = createArticle({
    title: ' Indoor Cat Enrichment Guide ',
    subtitle: ' Practical ideas ',
    summary: 'Simple ways to enrich an indoor cat routine.',
    body: 'Cats benefit from predictable play, food puzzles, and window time.',
    language: 'en-US',
    author: 'Asteria',
    createdAt: '2026-07-08T00:00:00.000Z',
    metadata: {
      status: 'draft',
      category: createCategory('Cat Care'),
      tags: normalizeTags(['Cat', ' Enrichment ', 'cat'])
    }
  });

  assert.equal(article.title, 'Indoor Cat Enrichment Guide');
  assert.equal(article.subtitle, 'Practical ideas');
  assert.equal(article.slug, 'indoor-cat-enrichment-guide');
  assert.equal(article.metadata.category?.slug, 'cat-care');
  assert.deepEqual(
    article.metadata.tags.map((tag) => tag.slug),
    ['cat', 'enrichment']
  );
});

test('article validation rejects missing body', () => {
  assert.throws(
    () =>
      createArticle({
        title: 'Missing body',
        summary: 'Summary exists.',
        body: '',
        language: 'en-US',
        createdAt: '2026-07-08T00:00:00.000Z'
      }),
    ArticleValidationError
  );
});

test('seo validation normalizes keywords', () => {
  const seo = createSEO({
    metaTitle: 'Indoor Cat Enrichment',
    metaDescription: 'Practical enrichment ideas for indoor cats.',
    keywords: ['Cat', 'enrichment', ' cat '],
    canonical: 'https://example.test/cat/enrichment',
    openGraph: {
      title: 'Indoor Cat Enrichment',
      type: 'article'
    },
    twitterCard: {
      card: 'summary_large_image'
    }
  });

  assert.deepEqual(seo.keywords, ['cat', 'enrichment']);
  assert.equal(seo.openGraph?.type, 'article');
});

test('seo validation rejects invalid canonical URL', () => {
  assert.throws(
    () =>
      createSEO({
        metaTitle: 'Title',
        metaDescription: 'Description',
        keywords: [],
        canonical: 'not-a-url'
      }),
    SEOValidationError
  );
});

test('faq validation trims valid FAQ entries', () => {
  const faq = createFAQ({
    question: ' How often should cats play? ',
    answer: ' Daily play is a useful routine. '
  });

  assert.equal(faq.question, 'How often should cats play?');
  assert.equal(faq.answer, 'Daily play is a useful routine.');
});

test('faq validation rejects missing answer', () => {
  assert.throws(
    () =>
      createFAQ({
        question: 'Question?',
        answer: ''
      }),
    FAQValidationError
  );
});

test('slug generation is stable', () => {
  assert.equal(slugify('  A Cat Care Guide: Food & Play! '), 'a-cat-care-guide-food-play');
  assert.equal(slugify(''), 'untitled');
});

test('content generation result normalizes metadata', () => {
  const article = createArticle({
    title: 'Cat Food Guide',
    summary: 'A dry-run article summary.',
    body: 'A dry-run article body.',
    language: 'en-US',
    createdAt: '2026-07-08T00:00:00.000Z'
  });
  const result = createContentGenerationResult({
    article,
    seo: {
      metaTitle: 'Cat Food Guide',
      metaDescription: 'A concise guide to cat food.',
      keywords: ['cat', 'food']
    },
    faq: [
      {
        question: 'Can cats eat wet food?',
        answer: 'Many cats can, but owners should follow safe feeding guidance.'
      }
    ],
    metadata: {
      zeta: true,
      empty: undefined,
      alpha: 'first'
    }
  });

  assert.deepEqual(Object.keys(result.metadata ?? {}), ['alpha', 'zeta']);
  assert.equal(result.article.slug, 'cat-food-guide');
  assert.equal(result.faq?.length, 1);
});

test('metadata normalization removes empty keys and undefined values', () => {
  const metadata = normalizeContentMetadata({
    '': 'ignored',
    beta: undefined,
    alpha: 1
  });

  assert.deepEqual(metadata, {
    alpha: 1
  });
});
