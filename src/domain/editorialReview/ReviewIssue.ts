import type { ReviewCategory } from './ReviewCategory.ts';
import type { ReviewSeverity } from './ReviewSeverity.ts';

export interface ReviewIssue {
  category: ReviewCategory;
  severity: ReviewSeverity;
  message: string;
  recommendation: string;
}

export function createReviewIssue(issue: ReviewIssue): ReviewIssue {
  return {
    category: issue.category,
    severity: issue.severity,
    message: issue.message.trim(),
    recommendation: issue.recommendation.trim()
  };
}

