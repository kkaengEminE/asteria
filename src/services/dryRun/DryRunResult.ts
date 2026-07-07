import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { PublishingResult, ResearchResult } from '../../core/types.ts';
import type { ImageAsset } from '../../domain/image/index.ts';
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
  researchPreview?: ResearchResult[];
  selectedImage?: DryRunSelectedImage;
  imageSelectionReason?: DryRunImageSelectionReason;
  imagePreview?: string;
  error?: string;
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
