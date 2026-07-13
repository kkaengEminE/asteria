export type ISODateString = string;

export type LocaleCode = string;

export type ContentFormat = 'article' | 'social' | 'newsletter' | 'podcastScript';

export interface ContentDraft {
  title: string;
  slug?: string;
  summary?: string;
  body: string;
  format: ContentFormat;
  language: LocaleCode;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ResearchQuery {
  topic: string;
  language?: LocaleCode;
  constraints?: string[];
  metadata?: Record<string, unknown>;
}

export interface ResearchResult {
  title: string;
  url?: string;
  source?: string;
  summary: string;
  publishedAt?: ISODateString;
  metadata?: Record<string, unknown>;
}

export interface ImageAsset {
  id: string;
  url: string;
  title?: string;
  altText?: string;
  license?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface PublishingDestination {
  type: string;
  name: string;
  enabled: boolean;
  dryRunOnly?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AffiliateLink {
  provider: string;
  label: string;
  url: string;
  disclosure?: string;
  metadata?: Record<string, unknown>;
}

export interface AudioAsset {
  id: string;
  url: string;
  format: 'mp3' | 'wav' | 'aac' | string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsEvent {
  name: string;
  occurredAt: ISODateString;
  properties?: Record<string, unknown>;
}

export interface AnalyticsSnapshot {
  source: string;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  metrics: Record<string, number>;
  metadata?: Record<string, unknown>;
}
