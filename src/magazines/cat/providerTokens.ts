import type { AIProvider, Publisher, ResearchProvider } from '../../core/index.ts';
import { createProviderToken } from '../../providers/index.ts';

export const mockResearchProviderToken = createProviderToken<ResearchProvider>(
  'Research',
  'mock-research',
  'Mock research provider for Cat Magazine dry runs.'
);

export const mockAiProviderToken = createProviderToken<AIProvider>(
  'AI',
  'mock-ai',
  'Mock AI provider for Cat Magazine dry runs.'
);

export const mockPublisherToken = createProviderToken<Publisher>(
  'Publisher',
  'mock-publisher',
  'Mock publisher for Cat Magazine dry-run previews.'
);

