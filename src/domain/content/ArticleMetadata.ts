import type { Category } from './Category.ts';
import type { ContentStatus } from './ContentStatus.ts';
import type { Tag } from './Tag.ts';
import { normalizeTags } from './Tag.ts';

export interface ArticleMetadata {
  status: ContentStatus;
  category?: Category;
  tags: Tag[];
  readingTimeMinutes?: number;
  sourceTopic?: string;
  generatedBy?: string;
  metadata?: Record<string, unknown>;
}

export function createArticleMetadata(metadata: Partial<ArticleMetadata> = {}): ArticleMetadata {
  return {
    status: metadata.status ?? 'draft',
    category: metadata.category,
    tags: normalizeTags(metadata.tags ?? []),
    readingTimeMinutes: metadata.readingTimeMinutes,
    sourceTopic: metadata.sourceTopic,
    generatedBy: metadata.generatedBy,
    metadata: metadata.metadata
  };
}

