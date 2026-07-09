import {
  createApprovalResult,
  type ApprovalDecision,
  type ApprovalReason,
  type ApprovalResult,
  type ApprovalStatus
} from '../../domain/approval/index.ts';
import type { EditorialReview } from '../../domain/editorialReview/index.ts';
import type { ContentQualityReport } from '../contentQuality/index.ts';
import type { RealGenerationReview } from '../realGenerationReview/index.ts';

export interface EditorialApprovalInput {
  validationResult: 'valid' | 'invalid' | string;
  validationErrors?: string[];
  qualityReport: ContentQualityReport;
  editorialReview: EditorialReview;
  realGenerationReview: RealGenerationReview;
}

export class EditorialApprovalService {
  evaluate(input: EditorialApprovalInput): ApprovalResult {
    const reasons = [
      ...reviewValidation(input),
      ...reviewQuality(input.qualityReport),
      ...reviewEditorial(input.editorialReview),
      ...reviewThreshold(input.realGenerationReview)
    ];
    const decision = determineDecision(reasons);
    const status = determineStatus(decision);
    const reviewedAt = new Date().toISOString();

    return createApprovalResult({
      decision,
      status,
      reasons,
      recommendations: uniqueRecommendations(reasons),
      blockingIssues: [],
      nonBlockingIssues: [],
      approvedAt: decision === 'APPROVED' ? reviewedAt : undefined,
      reviewedAt
    });
  }
}

function reviewValidation(input: EditorialApprovalInput): ApprovalReason[] {
  if (input.validationResult === 'valid' && (input.validationErrors?.length ?? 0) === 0) {
    return [];
  }

  return [
    blockingReason(
      'validation',
      `Validation result is ${input.validationResult}.`,
      (input.validationErrors ?? []).join('; ') || 'Resolve validation errors before approval.'
    )
  ];
}

function reviewQuality(qualityReport: ContentQualityReport): ApprovalReason[] {
  if (qualityReport.valid) {
    return [];
  }

  return [
    blockingReason(
      'quality',
      `Quality score is ${qualityReport.score}.`,
      qualityReport.errors.join('; ') || 'Resolve structural quality issues before approval.'
    )
  ];
}

function reviewEditorial(editorialReview: EditorialReview): ApprovalReason[] {
  if (editorialReview.result === 'FAIL') {
    return [
      blockingReason(
        'editorial',
        `Editorial review result is ${editorialReview.result}.`,
        'Resolve failing editorial issues before approval.'
      )
    ];
  }

  if (editorialReview.result === 'WARNING') {
    return [
      nonBlockingReason(
        'editorial',
        `Editorial review result is ${editorialReview.result}.`,
        'Review editorial warnings before publishing.'
      )
    ];
  }

  return [];
}

function reviewThreshold(realGenerationReview: RealGenerationReview): ApprovalReason[] {
  if (realGenerationReview.thresholdResult === 'FAIL') {
    return [
      blockingReason(
        'threshold',
        'Real generation threshold result is FAIL.',
        realGenerationReview.issues.map((issue) => issue.recommendation).join('; ') ||
          'Resolve threshold failures before approval.'
      )
    ];
  }

  if (realGenerationReview.thresholdResult === 'WARNING') {
    return [
      nonBlockingReason(
        'threshold',
        'Real generation threshold result is WARNING.',
        realGenerationReview.issues.map((issue) => issue.recommendation).join('; ') ||
          'Review threshold warnings before publishing.'
      )
    ];
  }

  return [];
}

function determineDecision(reasons: ApprovalReason[]): ApprovalDecision {
  if (reasons.some((reason) => reason.blocking)) {
    return 'REJECTED';
  }

  if (reasons.length > 0) {
    return 'NEEDS_REVIEW';
  }

  return 'APPROVED';
}

function determineStatus(decision: ApprovalDecision): ApprovalStatus {
  if (decision === 'APPROVED') {
    return 'ready';
  }

  if (decision === 'NEEDS_REVIEW') {
    return 'review_required';
  }

  return 'blocked';
}

function uniqueRecommendations(reasons: ApprovalReason[]): string[] {
  return [...new Set(reasons.map((reason) => reason.recommendation).filter(Boolean))];
}

function blockingReason(
  category: ApprovalReason['category'],
  message: string,
  recommendation: string
): ApprovalReason {
  return {
    category,
    message,
    blocking: true,
    recommendation
  };
}

function nonBlockingReason(
  category: ApprovalReason['category'],
  message: string,
  recommendation: string
): ApprovalReason {
  return {
    category,
    message,
    blocking: false,
    recommendation
  };
}

