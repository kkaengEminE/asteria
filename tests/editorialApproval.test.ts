import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EditorialReview } from '../src/domain/editorialReview/index.ts';
import { EditorialApprovalService } from '../src/services/editorialApproval/index.ts';
import type { ContentQualityReport } from '../src/services/contentQuality/index.ts';
import type { RealGenerationReview } from '../src/services/realGenerationReview/index.ts';

test('editorial approval approves clean package metadata', () => {
  const result = new EditorialApprovalService().evaluate({
    validationResult: 'valid',
    validationErrors: [],
    qualityReport: qualityReport(),
    editorialReview: editorialReview(),
    realGenerationReview: realGenerationReview()
  });

  assert.equal(result.decision, 'APPROVED');
  assert.equal(result.status, 'ready');
  assert.equal(result.reasons.length, 0);
  assert.equal(result.blockingIssues.length, 0);
  assert.ok(result.approvedAt);
});

test('editorial approval returns needs review for non-blocking warnings', () => {
  const result = new EditorialApprovalService().evaluate({
    validationResult: 'valid',
    validationErrors: [],
    qualityReport: qualityReport(),
    editorialReview: editorialReview({
      result: 'WARNING',
      score: 88,
      issues: [
        {
          category: 'readability',
          severity: 'warning',
          message: 'One sentence is long.',
          recommendation: 'Shorten the sentence.'
        }
      ]
    }),
    realGenerationReview: realGenerationReview({
      thresholdResult: 'WARNING',
      issues: [
        {
          category: 'article',
          severity: 'warning',
          message: 'Article structure is thin.',
          recommendation: 'Add another paragraph.'
        }
      ]
    })
  });

  assert.equal(result.decision, 'NEEDS_REVIEW');
  assert.equal(result.status, 'review_required');
  assert.equal(result.blockingIssues.length, 0);
  assert.ok(result.nonBlockingIssues.length > 0);
  assert.ok(result.recommendations.some((recommendation) => recommendation.includes('warnings')));
});

test('editorial approval rejects blocking validation or threshold issues', () => {
  const result = new EditorialApprovalService().evaluate({
    validationResult: 'invalid',
    validationErrors: ['Missing article body.'],
    qualityReport: qualityReport({
      valid: false,
      score: 40,
      errors: ['Article body is empty.']
    }),
    editorialReview: editorialReview({
      result: 'FAIL',
      score: 50
    }),
    realGenerationReview: realGenerationReview({
      thresholdResult: 'FAIL',
      issues: [
        {
          category: 'article',
          severity: 'fail',
          message: 'Article is too short.',
          recommendation: 'Expand the article.'
        }
      ]
    })
  });

  assert.equal(result.decision, 'REJECTED');
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockingIssues.length >= 1);
  assert.ok(result.recommendations.some((recommendation) => recommendation.includes('Missing article body')));
});

function qualityReport(overrides: Partial<ContentQualityReport> = {}): ContentQualityReport {
  return {
    valid: true,
    score: 100,
    errors: [],
    warnings: [],
    ...overrides
  };
}

function editorialReview(overrides: Partial<EditorialReview> = {}): EditorialReview {
  return {
    result: 'PASS',
    score: 100,
    summary: 'Editorial review PASS with score 100.',
    issues: [],
    reviewedAt: '2026-07-08T00:00:00.000Z',
    ...overrides
  };
}

function realGenerationReview(overrides: Partial<RealGenerationReview> = {}): RealGenerationReview {
  return {
    thresholdResult: 'PASS',
    articleTitle: 'Indoor Cat Enrichment',
    articleWordCount: 120,
    articleCharacterCount: 800,
    seoTitle: 'Indoor Cat Enrichment',
    seoDescription: 'Practical enrichment ideas.',
    faqCount: 2,
    qualityScore: 100,
    reviewScore: 100,
    seoComplete: true,
    articleStructure: {
      paragraphCount: 3,
      hasSubtitle: true,
      hasBody: true
    },
    faqUseful: true,
    summaryUseful: true,
    issues: [],
    thresholds: {
      minimumQualityScore: 85,
      minimumReviewScore: 80,
      minimumArticleWords: 80,
      requiredSeoFields: ['metaTitle', 'metaDescription', 'keywords']
    },
    ...overrides
  };
}

