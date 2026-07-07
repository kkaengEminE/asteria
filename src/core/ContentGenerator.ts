import type { ContentDraft, ResearchResult } from './types';
import type { MagazineConfig } from './MagazineConfig';

export interface ContentGenerationRequest {
  magazine: MagazineConfig;
  topic: string;
  research?: ResearchResult[];
  promptSet?: string;
  metadata?: Record<string, unknown>;
}

export interface ContentGenerator {
  generateContent(request: ContentGenerationRequest): Promise<ContentDraft>;
}

