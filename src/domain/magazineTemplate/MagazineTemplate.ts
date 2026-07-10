import type {
  MagazineAffiliatePolicy,
  MagazineImageStyle,
  MagazineSeoPolicy
} from '../magazineProfile/MagazineProfile.ts';

export interface MagazineReviewPolicy {
  minimumQualityScore: number;
  minimumReviewScore: number;
  minimumArticleWords: number;
}

export interface MagazineTemplate {
  id: string;
  persona: string;
  tone: string;
  promptProfile: string;
  seoPolicy: MagazineSeoPolicy;
  reviewPolicy: MagazineReviewPolicy;
  imagePolicy: MagazineImageStyle;
  affiliatePolicy: MagazineAffiliatePolicy;
  metadata?: Record<string, unknown>;
}
