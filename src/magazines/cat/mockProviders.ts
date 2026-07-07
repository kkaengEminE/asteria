import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  ResearchProvider
} from '../../core/index.ts';
import type { ResearchQuery, ResearchResult } from '../../core/types.ts';
import type { GoogleDriveImageRecord } from '../../providers/image/googleDrive/index.ts';
import type { CoupangProductRecord } from '../../providers/monetization/coupang/index.ts';

export function createMockResearchProvider(): ResearchProvider {
  return {
    name: 'mock-research',
    async search(query: ResearchQuery): Promise<ResearchResult[]> {
      return [
        {
          title: `Mock research brief for ${query.topic}`,
          source: 'Asteria Mock Research',
          summary: `Dry-run research summary for ${query.topic}. No external sources were called.`
        }
      ];
    }
  };
}

export function createMockAIProvider(): AIProvider {
  return {
    name: 'mock-ai',
    async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
      const isSeoPrompt = request.prompt.toLowerCase().includes('seo metadata');

      return {
        text: isSeoPrompt ? createMockSeo(request.prompt) : createMockArticle(request.prompt),
        model: 'mock-model'
      };
    }
  };
}

function createMockArticle(prompt: string): string {
  return [
    'Title: Mock Cat Care Article',
    '',
    'Summary: A dry-run article draft generated from the rendered Cat Magazine prompt.',
    '',
    'Body:',
    'This mock article verifies that configuration, prompts, providers, and workflows are connected.',
    'It does not call an AI API and should only be used as a preview artifact.',
    '',
    `Prompt preview: ${prompt.slice(0, 120)}`
  ].join('\n');
}

function createMockSeo(prompt: string): string {
  return [
    'Title Tag: Mock Cat Care Guide',
    'Meta Description: A dry-run SEO preview for a Cat Magazine article.',
    'Slug: mock-cat-care-guide',
    `Prompt preview: ${prompt.slice(0, 80)}`
  ].join('\n');
}

export const mockCatImageRecords: GoogleDriveImageRecord[] = [
  {
    id: 'cat-window-enrichment',
    filename: 'cat-window-enrichment.jpg',
    title: 'Cat watching enrichment toys by the window',
    description: 'A curious indoor cat near a window with enrichment toys.',
    tags: ['cat', 'window', 'enrichment', 'play', 'toy', 'cute', 'indoor'],
    category: 'hero',
    width: 1800,
    height: 1000,
    rating: 5,
    favorite: true,
    driveFileId: 'mock-drive-cat-window-enrichment',
    mockUri: 'mock://google-drive/cat-window-enrichment.jpg',
    checksum: 'mock-checksum-cat-window-enrichment'
  },
  {
    id: 'cat-sleep',
    filename: 'cat-sleep.jpg',
    title: 'Sleeping cat',
    description: 'A cute cat sleeping in soft light.',
    tags: ['cat', 'sleep', 'cute'],
    category: 'article',
    width: 1200,
    height: 900,
    rating: 4,
    favorite: false,
    driveFileId: 'mock-drive-cat-sleep',
    mockUri: 'mock://google-drive/cat-sleep.jpg'
  },
  {
    id: 'cat-food-health',
    filename: 'cat-food-health.jpg',
    title: 'Healthy cat food',
    description: 'A cat eating a balanced meal.',
    tags: ['cat', 'food', 'health'],
    category: 'article',
    width: 1400,
    height: 900,
    rating: 4,
    favorite: false,
    driveFileId: 'mock-drive-cat-food-health',
    mockUri: 'mock://google-drive/cat-food-health.jpg'
  },
  {
    id: 'cat-toy-play',
    filename: 'cat-toy-play.jpg',
    title: 'Cat playing with toy',
    description: 'An energetic cat playing with a toy.',
    tags: ['cat', 'play', 'toy', 'enrichment'],
    category: 'social',
    width: 1080,
    height: 1080,
    rating: 5,
    favorite: true,
    driveFileId: 'mock-drive-cat-toy-play',
    mockUri: 'mock://google-drive/cat-toy-play.jpg'
  }
];

export const mockCatCoupangProductRecords: CoupangProductRecord[] = [
  {
    id: 'cat-water-fountain',
    productName: 'Cat Water Fountain',
    productDescription: 'Mock Coupang-style fountain for cat hydration and indoor enrichment routines.',
    categoryName: 'cat-care',
    keywords: ['cat', 'fountain', 'health', 'water'],
    brandName: 'Mock Cat Home',
    priceAmount: 32900,
    currency: 'KRW',
    rating: 4.6,
    imageUrl: 'mock://coupang/images/cat-water-fountain.jpg',
    productUrl: 'mock://coupang/products/cat-water-fountain',
    coupangProductId: 'mock-coupang-cat-water-fountain',
    mockUri: 'mock://coupang/products/cat-water-fountain'
  },
  {
    id: 'cat-wet-food',
    productName: 'Cat Wet Food Variety Pack',
    productDescription: 'Mock wet food listing for cat food and hydration-focused care articles.',
    categoryName: 'cat-care',
    keywords: ['cat', 'food', 'health', 'wet-food'],
    brandName: 'Mock Pantry',
    priceAmount: 24900,
    currency: 'KRW',
    rating: 4.4,
    imageUrl: 'mock://coupang/images/cat-wet-food.jpg',
    productUrl: 'mock://coupang/products/cat-wet-food',
    coupangProductId: 'mock-coupang-cat-wet-food',
    mockUri: 'mock://coupang/products/cat-wet-food'
  },
  {
    id: 'cat-enrichment-toy',
    productName: 'Interactive Cat Enrichment Toy',
    productDescription: 'Mock indoor enrichment toy for curious cats that need play and puzzle time.',
    categoryName: 'cat-care',
    keywords: ['cat', 'enrichment', 'play', 'toy', 'indoor'],
    brandName: 'Mock Play Lab',
    priceAmount: 18900,
    currency: 'KRW',
    rating: 4.9,
    imageUrl: 'mock://coupang/images/cat-enrichment-toy.jpg',
    productUrl: 'mock://coupang/products/cat-enrichment-toy',
    coupangProductId: 'mock-coupang-cat-enrichment-toy',
    mockUri: 'mock://coupang/products/cat-enrichment-toy'
  },
  {
    id: 'cat-litter',
    productName: 'Low Dust Cat Litter',
    productDescription: 'Mock litter listing for practical indoor cat care content.',
    categoryName: 'cat-care',
    keywords: ['cat', 'litter', 'indoor'],
    brandName: 'Mock Clean Paws',
    priceAmount: 21900,
    currency: 'KRW',
    rating: 4.3,
    imageUrl: 'mock://coupang/images/cat-litter.jpg',
    productUrl: 'mock://coupang/products/cat-litter',
    coupangProductId: 'mock-coupang-cat-litter',
    mockUri: 'mock://coupang/products/cat-litter'
  },
  {
    id: 'cat-scratcher',
    productName: 'Cat Scratcher Board',
    productDescription: 'Mock scratcher for indoor enrichment, window lounging, and healthy claw routines.',
    categoryName: 'cat-care',
    keywords: ['cat', 'enrichment', 'scratcher', 'window', 'indoor'],
    brandName: 'Mock Scratch Co',
    priceAmount: 16900,
    currency: 'KRW',
    rating: 4.5,
    imageUrl: 'mock://coupang/images/cat-scratcher.jpg',
    productUrl: 'mock://coupang/products/cat-scratcher',
    coupangProductId: 'mock-coupang-cat-scratcher',
    mockUri: 'mock://coupang/products/cat-scratcher'
  },
  {
    id: 'cat-grooming-brush',
    productName: 'Cat Grooming Brush',
    productDescription: 'Mock grooming brush for cat health and regular home care routines.',
    categoryName: 'cat-care',
    keywords: ['cat', 'grooming', 'health'],
    brandName: 'Mock Groom',
    priceAmount: 12900,
    currency: 'KRW',
    rating: 4.2,
    imageUrl: 'mock://coupang/images/cat-grooming-brush.jpg',
    productUrl: 'mock://coupang/products/cat-grooming-brush',
    coupangProductId: 'mock-coupang-cat-grooming-brush',
    mockUri: 'mock://coupang/products/cat-grooming-brush'
  }
];
