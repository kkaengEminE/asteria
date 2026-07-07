export interface RecommendationReason {
  code: string;
  message: string;
}

export function createRecommendationReason(code: string, message: string): RecommendationReason {
  return {
    code,
    message
  };
}

