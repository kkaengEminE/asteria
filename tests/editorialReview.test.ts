import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublishingPackage, type PublishingPackage } from '../src/domain/content/index.ts';
import { EditorialReviewService } from '../src/services/editorialReview/index.ts';

test('editorial review service returns pass for ready content', () => {
  const service = new EditorialReviewService({
    minimumArticleWords: 10
  });
  const review = service.review(createPackageFixture());

  assert.equal(review.result, 'PASS');
  assert.equal(review.issues.length, 0);
  assert.ok(review.score >= 95);
  assert.match(review.summary, /PASS/);
});

test('editorial review classifies issues by category and severity', () => {
  const service = new EditorialReviewService({
    minimumArticleWords: 80,
    minimumSummaryCharacters: 40
  });
  const review = service.review({
    ...createPackageFixture(),
    article: {
      ...createPackageFixture().article,
      title: '',
      body: 'Short.',
      author: ''
    },
    summary: {
      text: 'Tiny.'
    },
    seo: {
      metaTitle: '',
      metaDescription: '',
      keywords: []
    },
    faq: [
      {
        question: 'Is enrichment important?',
        answer: 'Yes.'
      },
      {
        question: 'Is enrichment important?',
        answer: 'Duplicate.'
      }
    ]
  });

  assert.equal(review.result, 'FAIL');
  assert.ok(review.score < 70);
  assert.ok(review.issues.some((issue) => issue.category === 'title' && issue.severity === 'fail'));
  assert.ok(review.issues.some((issue) => issue.category === 'seo' && issue.severity === 'fail'));
  assert.ok(review.issues.some((issue) => issue.category === 'faq' && issue.severity === 'warning'));
  assert.ok(review.issues.every((issue) => issue.recommendation.length > 0));
});

test('editorial review score is separate from structural quality score', () => {
  const service = new EditorialReviewService({
    minimumArticleWords: 200
  });
  const review = service.review(createPackageFixture());

  assert.equal(review.result, 'WARNING');
  assert.ok(review.score < 100);
  assert.ok(review.issues.some((issue) => issue.category === 'readability'));
});

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'Indoor Cat Enrichment',
      summary: 'A complete article summary for editorial review.',
      body: [
        'Indoor cats benefit from predictable routines, daily play, and safe climbing spaces.',
        'Food puzzles, window perches, and short interactive sessions can reduce boredom.',
        'Owners should introduce enrichment gradually and watch how each cat responds.'
      ].join(' '),
      slug: 'indoor-cat-enrichment',
      language: 'en-US',
      author: 'Asteria',
      createdAt: '2026-07-08T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: []
      }
    },
    summary: {
      text: 'A practical editorial-ready summary for indoor cat enrichment.',
      bullets: ['Routine', 'Play', 'Environment']
    },
    seo: {
      metaTitle: 'Indoor Cat Enrichment',
      metaDescription: 'Practical indoor cat enrichment ideas.',
      keywords: ['cat', 'enrichment']
    },
    faq: [
      {
        question: 'Is enrichment important?',
        answer: 'Yes, it supports activity and routine.'
      }
    ],
    imagePrompt: {
      prompt: 'A happy indoor cat playing near a window.'
    },
    productPrompt: {
      prompt: 'Find safe enrichment product ideas for indoor cats.'
    }
  });
}

