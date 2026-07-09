import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublishingPackage, type PublishingPackage } from '../src/domain/content/index.ts';
import { ContentQualityValidator } from '../src/services/contentQuality/index.ts';

test('content quality validator accepts complete content', () => {
  const validator = new ContentQualityValidator();
  const report = validator.validate(createPackageFixture());

  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
  assert.ok(report.score >= 90);
});

test('content quality validator reports quality problems', () => {
  const validator = new ContentQualityValidator({
    minimumArticleLength: 200,
    minimumSummaryLength: 60
  });
  const report = validator.validate({
    ...createPackageFixture(),
    article: {
      ...createPackageFixture().article,
      body: 'Too short.'
    },
    summary: {
      text: 'Short.'
    },
    seo: {
      metaTitle: '',
      metaDescription: '',
      keywords: []
    }
  });

  assert.equal(report.valid, false);
  assert.match(report.errors.join(' '), /SEO metaTitle/);
  assert.match(report.errors.join(' '), /SEO keywords/);
  assert.ok(report.warnings.length >= 2);
  assert.ok(report.score < 100);
});

test('content quality validator detects duplicate faq entries before normalization', () => {
  const validator = new ContentQualityValidator();
  const report = validator.validate({
    ...createPackageFixture(),
    faq: [
      {
        question: 'Is this normal?',
        answer: 'Yes.'
      },
      {
        question: 'Is this normal?',
        answer: 'Duplicate.'
      }
    ]
  });

  assert.equal(report.valid, true);
  assert.match(report.warnings.join(' '), /Duplicate FAQ/);
  assert.ok(report.score < 100);
});

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'Indoor Cat Enrichment',
      summary: 'A complete article summary for quality validation.',
      body: 'Indoor cats benefit from routines, play, food puzzles, and safe climbing spaces. This article gives practical and structured advice for owners.',
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
      text: 'A practical quality-checked summary for indoor cat enrichment.',
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
