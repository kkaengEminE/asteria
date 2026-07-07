import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { PublishingResult, ResearchResult } from '../../core/types.ts';
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
  error?: string;
}

export function summarizeMagazine(config: MagazineConfig): DryRunMagazineSummary {
  return {
    name: config.name,
    slug: config.slug,
    language: config.language
  };
}

