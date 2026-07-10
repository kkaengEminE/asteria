import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { PublishingResult, ResearchResult } from '../../core/types.ts';
import type { AuditEvent } from '../../domain/audit/index.ts';
import type { ApprovalResult } from '../../domain/approval/index.ts';
import type { PublishingPackage } from '../../domain/content/index.ts';
import type { PublishingQueueResult } from '../../domain/publishingQueue/index.ts';
import type { RetryResult } from '../../domain/retry/index.ts';
import type { JobExecutionResult, ScheduleResult } from '../../domain/scheduler/index.ts';
import type { EditorialReview, ReviewIssue, ReviewResult } from '../../domain/editorialReview/index.ts';
import type { ImageAsset } from '../../domain/image/index.ts';
import type { AffiliateLink, Recommendation } from '../../domain/monetization/index.ts';
import type { RealGenerationReview } from '../realGenerationReview/index.ts';
import type { WorkflowResult } from '../../workflows/index.ts';

export interface DryRunMagazineSummary {
  name: string;
  slug: string;
  language: string;
}

export interface DryRunResult {
  magazine?: DryRunMagazineSummary;
  topic: string;
  workflowStatus: WorkflowResult['status'];
  executedSteps: string[];
  renderedPromptPreview?: string;
  articlePreview?: string;
  seoPreview?: string;
  publishPreview?: PublishingResult;
  queueResult?: PublishingQueueResult;
  schedulerResult?: ScheduleResult;
  executionResult?: JobExecutionResult;
  auditTimeline?: AuditEvent[];
  retryMetadata?: RetryResult;
  researchPreview?: ResearchResult[];
  selectedImage?: DryRunSelectedImage;
  imageSelectionReason?: DryRunImageSelectionReason;
  imagePreview?: string;
  recommendedProducts?: DryRunRecommendedProduct[];
  affiliateLinks?: AffiliateLink[];
  monetizationPreview?: string;
  affiliateDisclosure?: string;
  publishingPackage?: PublishingPackage;
  contentGenerationMetadata?: DryRunContentGenerationMetadata;
  error?: string;
}

export interface DryRunContentGenerationMetadata {
  providerName?: string;
  modelName?: string;
  language?: string;
  tokenUsage?: unknown;
  promptProfile?: string;
  promptId?: string;
  promptIds?: string[];
  promptVersion?: string;
  renderedVariables?: Record<string, unknown>;
  renderedPromptPreview?: string;
  composedPromptPreview?: string;
  retryCount?: number;
  validationResult?: string;
  validationErrors?: string[];
  qualityScore?: number;
  qualityReport?: unknown;
  editorialReview?: EditorialReview;
  reviewScore?: number;
  reviewResult?: ReviewResult;
  reviewSummary?: string;
  reviewIssues?: ReviewIssue[];
  realGenerationReview?: RealGenerationReview;
  realGenerationThresholdResult?: RealGenerationReview['thresholdResult'];
  approvalResult?: ApprovalResult;
  approvalDecision?: ApprovalResult['decision'];
  generationDurationMs?: number;
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

export function summarizeMagazine(config: MagazineConfig): DryRunMagazineSummary {
  return {
    name: config.name,
    slug: config.slug,
    language: config.language
  };
}

export function summarizeImage(asset: ImageAsset): DryRunSelectedImage {
  return {
    id: asset.id,
    filename: asset.metadata.filename,
    title: asset.metadata.title,
    description: asset.metadata.description,
    tags: asset.metadata.tags,
    category: asset.metadata.category,
    orientation: asset.metadata.orientation,
    rating: asset.metadata.rating,
    favorite: asset.metadata.favorite
  };
}

export function summarizeRecommendations(recommendations: Recommendation[] = []): DryRunRecommendedProduct[] {
  return recommendations.map((recommendation) => ({
    id: recommendation.product.id,
    name: recommendation.product.name,
    description: recommendation.product.description,
    category: recommendation.product.category,
    tags: recommendation.product.tags,
    brand: recommendation.product.brand,
    price: recommendation.product.price,
    rating: recommendation.product.rating,
    thumbnail: recommendation.product.thumbnail,
    url: recommendation.product.url,
    reason: recommendation.reason.message,
    confidence: recommendation.confidence,
    priority: recommendation.priority,
    score: recommendation.score
  }));
}
