import type { AffiliateLink, ContentDraft } from './types';
import type { MagazineConfig } from './MagazineConfig';

export interface AffiliateRequest {
  magazine: MagazineConfig;
  draft: ContentDraft;
  topic?: string;
  metadata?: Record<string, unknown>;
}

export interface AffiliateProvider {
  readonly name: string;
  createLinks(request: AffiliateRequest): Promise<AffiliateLink[]>;
}

