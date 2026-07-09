import type { ApprovalDecision } from './ApprovalDecision.ts';
import { createApprovalReason, type ApprovalReason } from './ApprovalReason.ts';
import type { ApprovalStatus } from './ApprovalStatus.ts';

export interface ApprovalResult {
  decision: ApprovalDecision;
  status: ApprovalStatus;
  reasons: ApprovalReason[];
  recommendations: string[];
  blockingIssues: ApprovalReason[];
  nonBlockingIssues: ApprovalReason[];
  approvedAt?: string;
  reviewedAt: string;
}

export function createApprovalResult(result: ApprovalResult): ApprovalResult {
  const reasons = result.reasons.map(createApprovalReason);

  return {
    decision: result.decision,
    status: result.status,
    reasons,
    recommendations: result.recommendations.map((recommendation) => recommendation.trim()).filter(Boolean),
    blockingIssues: reasons.filter((reason) => reason.blocking),
    nonBlockingIssues: reasons.filter((reason) => !reason.blocking),
    approvedAt: result.approvedAt,
    reviewedAt: result.reviewedAt
  };
}

