import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublishingPackage, type PublishingPackage } from '../src/domain/content/index.ts';
import { EditorialReviewService } from '../src/services/editorialReview/index.ts';
import { ContentQualityValidator } from '../src/services/contentQuality/index.ts';
import { RealGenerationReviewService } from '../src/services/realGenerationReview/index.ts';

test('real generation review passes when thresholds are met', () => {
  const review = reviewPackage(createPackageFixture(), new RealGenerationReviewService({
    minimumArticleWords: 20,
    minimumQualityScore: 80,
    minimumReviewScore: 80
  }));

  assert.equal(review.thresholdResult, 'PASS');
  assert.equal(review.seoComplete, true);
  assert.equal(review.faqUseful, true);
  assert.equal(review.summaryUseful, true);
  assert.equal(review.issues.length, 0);
});

test('real generation review warns for weak structure without failing thresholds', () => {
  const review = reviewPackage({
    ...createPackageFixture(),
    article: {
      ...createPackageFixture().article,
      body: 'This article has enough words for the configured threshold but only one paragraph for structure review.'
    }
  }, new RealGenerationReviewService({
    minimumArticleWords: 5,
    minimumQualityScore: 80,
    minimumReviewScore: 80
  }));

  assert.equal(review.thresholdResult, 'WARNING');
  assert.ok(review.issues.some((issue) => issue.category === 'article' && issue.severity === 'warning'));
});

test('real generation review fails when scores and article length miss thresholds', () => {
  const review = reviewPackage({
    ...createPackageFixture(),
    article: {
      ...createPackageFixture().article,
      body: 'Too short.'
    },
    summary: {
      text: 'Thin.'
    }
  }, new RealGenerationReviewService({
    minimumArticleWords: 100,
    minimumQualityScore: 99,
    minimumReviewScore: 99
  }));

  assert.equal(review.thresholdResult, 'FAIL');
  assert.ok(review.issues.some((issue) => issue.category === 'article' && issue.severity === 'fail'));
  assert.ok(review.articleWordCount < 100);
});

test('real generation review detects SEO completeness gaps', () => {
  const review = reviewPackage({
    ...createPackageFixture(),
    seo: {
      metaTitle: '',
      metaDescription: '',
      keywords: []
    }
  }, new RealGenerationReviewService());

  assert.equal(review.thresholdResult, 'FAIL');
  assert.equal(review.seoComplete, false);
  assert.ok(review.issues.some((issue) => issue.category === 'seo'));
});

test('real generation review detects FAQ and summary usefulness gaps', () => {
  const review = reviewPackage({
    ...createPackageFixture(),
    summary: {
      text: 'Short.'
    },
    faq: [
      {
        question: 'FAQ?',
        answer: 'Short.'
      }
    ]
  }, new RealGenerationReviewService({
    minimumArticleWords: 20
  }));

  assert.equal(review.thresholdResult, 'WARNING');
  assert.equal(review.faqUseful, false);
  assert.equal(review.summaryUseful, false);
  assert.ok(review.issues.some((issue) => issue.category === 'faq'));
  assert.ok(review.issues.some((issue) => issue.category === 'summary'));
});

function reviewPackage(pkg: PublishingPackage, service: RealGenerationReviewService) {
  const qualityReport = new ContentQualityValidator({
    minimumArticleLength: 20,
    minimumSummaryLength: 5
  }).validate(pkg);
  const editorialReview = new EditorialReviewService({
    minimumArticleWords: 5,
    minimumSummaryCharacters: 5
  }).review(pkg);

  return service.review(pkg, qualityReport, editorialReview);
}

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'Indoor Cat Enrichment',
      subtitle: 'A practical home guide',
      summary: 'A complete article summary for real generation review.',
      body: [
        'Indoor cats benefit from predictable routines, daily play, and safe climbing spaces.',
        '',
        'Food puzzles, window perches, and short interactive sessions can reduce boredom while supporting natural behaviors.'
      ].join('\n'),
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
      text: 'A practical summary for reviewing indoor cat enrichment content.',
      bullets: ['Routine', 'Play', 'Environment']
    },
    seo: {
      metaTitle: 'Indoor Cat Enrichment',
      metaDescription: 'Practical indoor cat enrichment ideas.',
      keywords: ['cat', 'enrichment']
    },
    faq: [
      {
        question: 'How often should cats play?',
        answer: 'Most cats benefit from several short daily play sessions.'
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

