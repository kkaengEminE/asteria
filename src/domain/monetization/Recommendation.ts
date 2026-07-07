import type { AffiliateLink } from './AffiliateLink.ts';
import type { Product } from './Product.ts';
import type { RecommendationReason } from './RecommendationReason.ts';

export interface Recommendation {
  product: Product;
  reason: RecommendationReason;
  confidence: number;
  relatedTopic?: string;
  priority: number;
  score: number;
  affiliateLink?: AffiliateLink;
}

export class RecommendationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecommendationValidationError';
  }
}

export function createRecommendation(recommendation: Recommendation): Recommendation {
  validateRecommendation(recommendation);
  return recommendation;
}

export function validateRecommendation(recommendation: Recommendation): void {
  if (recommendation.confidence < 0 || recommendation.confidence > 1) {
    throw new RecommendationValidationError('Recommendation confidence must be between 0 and 1.');
  }

  if (recommendation.priority < 0) {
    throw new RecommendationValidationError('Recommendation priority cannot be negative.');
  }

  if (recommendation.score < 0) {
    throw new RecommendationValidationError('Recommendation score cannot be negative.');
  }
}

