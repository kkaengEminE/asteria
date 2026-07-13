import type { ResearchProvider } from '../../core/index.ts';
import type { ImageDomainLibrary } from '../../domain/image/index.ts';
import type { MonetizationProvider } from '../../domain/monetization/index.ts';
import type { Publisher } from '../../domain/publisher/index.ts';
import type { AIProvider } from '../../providers/ai/index.ts';
import { createProviderToken } from '../../providers/index.ts';

export const mockResearchProviderToken = createProviderToken<ResearchProvider>(
  'Research',
  'mock-research',
  'Mock research provider for Magazine dry runs.'
);

export const mockAiProviderToken = createProviderToken<AIProvider>(
  'AI',
  'mock-ai',
  'Mock AI provider for Magazine dry runs.'
);

export const mockPublisherToken = createProviderToken<Publisher>(
  'Publisher',
  'mock-publisher',
  'Mock publisher for Magazine dry-run previews.'
);

export const mockImageLibraryToken = createProviderToken<ImageDomainLibrary>(
  'Image',
  'mock-google-drive-images',
  'Mock Google Drive image library for Magazine dry runs.'
);

export const mockMonetizationProviderToken = createProviderToken<MonetizationProvider>(
  'Affiliate',
  'mock-coupang-affiliate',
  'Mock Coupang affiliate provider for Magazine dry runs.'
);
