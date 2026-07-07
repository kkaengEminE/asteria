import type { Recommendation } from './Recommendation.ts';

export interface MonetizationResult {
  topic: string;
  recommendations: Recommendation[];
  preview: string;
  metadata?: Record<string, unknown>;
}

export function createMonetizationPreview(topic: string, recommendations: Recommendation[]): MonetizationResult {
  return {
    topic,
    recommendations,
    preview:
      recommendations.length === 0
        ? `No monetization recommendations for ${topic}.`
        : recommendations
            .map(
              (recommendation, index) =>
                `${index + 1}. ${recommendation.product.name} - ${recommendation.reason.message}`
            )
            .join('\n'),
    metadata: {
      dryRun: true
    }
  };
}

