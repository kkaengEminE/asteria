import type { ResearchProvider } from '../../core/index.ts';
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

export const mockDogImageRecords: GoogleDriveImageRecord[] = [
  {
    id: 'dog-walk-sniffing',
    filename: 'dog-walk-sniffing.jpg',
    title: 'Dog sniffing during a walk',
    description: 'A relaxed dog exploring scents on a neighborhood walk.',
    tags: ['dog', 'walk', 'walking', 'sniff', 'sniffing', 'training', 'enrichment', 'cute'],
    category: 'hero',
    width: 1800,
    height: 1000,
    rating: 5,
    favorite: true,
    driveFileId: 'mock-drive-dog-walk-sniffing',
    mockUri: 'mock://google-drive/dog-walk-sniffing.jpg',
    checksum: 'mock-checksum-dog-walk-sniffing'
  },
  {
    id: 'dog-training-play',
    filename: 'dog-training-play.jpg',
    title: 'Dog training through play',
    description: 'A dog practicing simple training with a toy reward.',
    tags: ['dog', 'training', 'play', 'toy', 'enrichment'],
    category: 'article',
    width: 1400,
    height: 900,
    rating: 4,
    favorite: false,
    driveFileId: 'mock-drive-dog-training-play',
    mockUri: 'mock://google-drive/dog-training-play.jpg'
  },
  {
    id: 'dog-grooming-health',
    filename: 'dog-grooming-health.jpg',
    title: 'Dog grooming care',
    description: 'A calm dog being brushed at home.',
    tags: ['dog', 'grooming', 'health', 'home'],
    category: 'article',
    width: 1200,
    height: 900,
    rating: 4,
    favorite: false,
    driveFileId: 'mock-drive-dog-grooming-health',
    mockUri: 'mock://google-drive/dog-grooming-health.jpg'
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

export const mockDogCoupangProductRecords: CoupangProductRecord[] = [
  {
    id: 'dog-walking-harness',
    productName: 'Dog Walking Harness',
    productDescription: 'Mock Coupang-style harness for safe everyday dog walks.',
    categoryName: 'dog-care',
    keywords: ['dog', 'walk', 'walking', 'training', 'harness'],
    brandName: 'Mock Dog Walk',
    priceAmount: 29900,
    currency: 'KRW',
    rating: 4.7,
    imageUrl: 'mock://coupang/images/dog-walking-harness.jpg',
    productUrl: 'mock://coupang/products/dog-walking-harness',
    coupangProductId: 'mock-coupang-dog-walking-harness',
    mockUri: 'mock://coupang/products/dog-walking-harness'
  },
  {
    id: 'dog-snuffle-mat',
    productName: 'Dog Snuffle Mat',
    productDescription: 'Mock enrichment mat for dogs that enjoy scent work and slow feeding.',
    categoryName: 'dog-care',
    keywords: ['dog', 'sniff', 'sniffing', 'enrichment', 'food'],
    brandName: 'Mock Nose Work',
    priceAmount: 21900,
    currency: 'KRW',
    rating: 4.8,
    imageUrl: 'mock://coupang/images/dog-snuffle-mat.jpg',
    productUrl: 'mock://coupang/products/dog-snuffle-mat',
    coupangProductId: 'mock-coupang-dog-snuffle-mat',
    mockUri: 'mock://coupang/products/dog-snuffle-mat'
  },
  {
    id: 'dog-training-treats',
    productName: 'Dog Training Treats',
    productDescription: 'Mock training treats for reward-based dog learning routines.',
    categoryName: 'dog-care',
    keywords: ['dog', 'training', 'treat', 'walk'],
    brandName: 'Mock Treat Lab',
    priceAmount: 14900,
    currency: 'KRW',
    rating: 4.4,
    imageUrl: 'mock://coupang/images/dog-training-treats.jpg',
    productUrl: 'mock://coupang/products/dog-training-treats',
    coupangProductId: 'mock-coupang-dog-training-treats',
    mockUri: 'mock://coupang/products/dog-training-treats'
  }
];
