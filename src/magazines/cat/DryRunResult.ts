import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { PublishingResult, ResearchResult } from '../../core/types.ts';
import type { WorkflowResult } from '../../workflows/index.ts';

export interface DryRunResult {
  magazine?: Pick<MagazineConfig, 'name' | 'slug' | 'language'>;
  topic: string;
  workflowStatus: WorkflowResult['status'];
  executedSteps: string[];
  renderedPromptPreview?: string;
  generatedMockArticle?: string;
  seoPreview?: string;
  publishPreview?: PublishingResult;
  researchPreview?: ResearchResult[];
  error?: string;
}

