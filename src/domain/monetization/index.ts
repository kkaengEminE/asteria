export { createMockAffiliateLink, validateAffiliateLink, AffiliateLinkValidationError } from './AffiliateLink.ts';
export type { AffiliateLink } from './AffiliateLink.ts';
export { createMonetizationPreview } from './MonetizationResult.ts';
export type { MonetizationResult } from './MonetizationResult.ts';
export { MockMonetizationProvider } from './MonetizationProvider.ts';
export type {
  MockMonetizationProviderOptions,
  MonetizationProvider,
  MonetizationProviderDiagnostics
} from './MonetizationProvider.ts';
export { createProduct, normalizeProductTags, validateProduct, ProductValidationError } from './Product.ts';
export type { Product, ProductPrice } from './Product.ts';
export { matchesProductSearchQuery, scoreProductForQuery } from './ProductSearchQuery.ts';
export type { ProductSearchQuery } from './ProductSearchQuery.ts';
export { createRecommendation, validateRecommendation, RecommendationValidationError } from './Recommendation.ts';
export type { Recommendation } from './Recommendation.ts';
export { createRecommendationReason } from './RecommendationReason.ts';
export type { RecommendationReason } from './RecommendationReason.ts';
