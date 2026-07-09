import { createReviewIssue, type ReviewIssue } from './ReviewIssue.ts';
import type { ReviewResult } from './ReviewResult.ts';

export interface EditorialReview {
  result: ReviewResult;
  score: number;
  summary: string;
  issues: ReviewIssue[];
  reviewedAt: string;
}

export function createEditorialReview(review: EditorialReview): EditorialReview {
  const issues = review.issues.map(createReviewIssue);

  return {
    result: review.result,
    score: clampReviewScore(review.score),
    summary: review.summary.trim(),
    issues,
    reviewedAt: review.reviewedAt
  };
}

export function determineReviewResult(issues: ReviewIssue[]): ReviewResult {
  if (issues.some((issue) => issue.severity === 'fail')) {
    return 'FAIL';
  }

  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'WARNING';
  }

  return 'PASS';
}

export function clampReviewScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

