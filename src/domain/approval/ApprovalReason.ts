export interface ApprovalReason {
  category: 'validation' | 'quality' | 'editorial' | 'threshold';
  message: string;
  blocking: boolean;
  recommendation: string;
}

export function createApprovalReason(reason: ApprovalReason): ApprovalReason {
  return {
    category: reason.category,
    message: reason.message.trim(),
    blocking: reason.blocking,
    recommendation: reason.recommendation.trim()
  };
}

