import type { ResearchResult } from '../../core/types.ts';
import type { AuditEvent } from '../../domain/audit/index.ts';
import type { AffiliateLink, MonetizationProviderDiagnostics } from '../../domain/monetization/index.ts';
import type { PublishingPackage } from '../../domain/content/index.ts';
import type { ChannelPreview } from '../../domain/preview/index.ts';
import type { MetricSnapshot } from '../../domain/metrics/index.ts';
import type { PublishingQueueResult } from '../../domain/publishingQueue/index.ts';
import type { PublishResult } from '../../domain/publisher/index.ts';
import type { RetryResult } from '../../domain/retry/index.ts';
import type { JobExecutionResult, ScheduleResult } from '../../domain/scheduler/index.ts';

export interface DryRunPreviewReport {
  content: DryRunContentPreview;
  media: DryRunMediaPreview;
  monetization: DryRunMonetizationPreview;
  channels: ChannelPreview[];
  publishing: DryRunPublishingPreview;
  observability: DryRunObservabilityPreview;
}

export interface DryRunContentPreview {
  renderedPromptPreview?: string;
  articlePreview?: string;
  seoPreview?: string;
  publishingPackage?: PublishingPackage;
  researchPreview?: ResearchResult[];
  metadata?: unknown;
}

export interface DryRunMediaPreview {
  selectedImage?: DryRunSelectedImage;
  imageSelectionReason?: DryRunImageSelectionReason;
  imagePreview?: string;
}

export interface DryRunSelectedImage {
  id: string;
  filename: string;
  title?: string;
  description?: string;
  tags: string[];
  category?: string;
  orientation: string;
  rating?: number;
  favorite?: boolean;
}

export interface DryRunImageSelectionReason {
  score: number;
  reasons: string[];
}

export interface DryRunMonetizationPreview {
  recommendedProducts?: DryRunRecommendedProduct[];
  affiliateLinks?: AffiliateLink[];
  diagnostics?: MonetizationProviderDiagnostics;
  preview?: string;
  disclosure?: string;
}

export interface DryRunRecommendedProduct {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags: string[];
  brand?: string;
  price?: {
    amount: number;
    currency: string;
  };
  rating?: number;
  thumbnail?: string;
  url?: string;
  reason: string;
  confidence: number;
  priority: number;
  score: number;
}

export interface DryRunPublishingPreview {
  publishPreview?: PublishResult;
  queueResult?: PublishingQueueResult;
  schedulerResult?: ScheduleResult;
  executionResult?: JobExecutionResult;
  publisherResult?: PublishResult;
}

export interface DryRunObservabilityPreview {
  metricsSnapshot?: MetricSnapshot;
  auditTimeline?: AuditEvent[];
  retryMetadata?: RetryResult;
}
