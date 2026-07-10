export interface MagazineSeoPolicy {
  primaryKeywordStrategy: string;
  metaDescriptionStyle: string;
  keywordCount?: number;
}

export interface MagazineImageStyle {
  description: string;
  preferredOrientation?: string;
  mood?: string;
}

export interface MagazineAffiliatePolicy {
  enabled: boolean;
  disclosure: string;
  preferredCategories: string[];
}

export interface MagazineProfile {
  id: string;
  template?: string;
  name: string;
  language: string;
  audience: string;
  persona: string;
  tone: string;
  style: string;
  promptProfile?: string;
  seoPolicy: MagazineSeoPolicy;
  reviewPolicy?: {
    minimumQualityScore: number;
    minimumReviewScore: number;
    minimumArticleWords: number;
  };
  imageStyle: MagazineImageStyle;
  affiliatePolicy: MagazineAffiliatePolicy;
  categories: string[];
  metadata?: Record<string, unknown>;
}
