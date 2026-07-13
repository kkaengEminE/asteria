import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublishingPackage, createTag } from '../src/domain/content/index.ts';
import type { ImageAsset } from '../src/domain/image/index.ts';
import type { MagazineProfile } from '../src/domain/magazineProfile/index.ts';
import { InstagramContentService } from '../src/services/instagram/index.ts';

test('instagram content service generates captions from publishing package', () => {
  const result = new InstagramContentService().generate({
    publishingPackage: createPackageFixture(),
    magazineProfile: createProfileFixture(),
    selectedImage: createImageFixture(),
    topic: 'indoor enrichment'
  });

  assert.match(result.post.caption.short, /Indoor Cat Enrichment Guide/);
  assert.match(result.post.caption.long, /A practical summary for indoor cats/);
  assert.match(result.post.caption.cta, /Save this cat guide/);
});

test('instagram content service generates hashtag groups', () => {
  const result = new InstagramContentService().generate({
    publishingPackage: createPackageFixture(),
    magazineProfile: createProfileFixture(),
    selectedImage: createImageFixture(),
    topic: 'indoor enrichment'
  });

  assert.deepEqual(result.post.hashtags.primary, ['#catcare', '#enrichment', '#indoorcats']);
  assert.equal(result.post.hashtags.secondary.includes('#cat'), true);
  assert.equal(result.post.hashtags.branded.includes('#CatMagazine'), true);
});

test('instagram content service reuses seo keywords and magazine profile', () => {
  const result = new InstagramContentService().generate({
    publishingPackage: createPackageFixture(),
    magazineProfile: createProfileFixture(),
    selectedImage: createImageFixture(),
    topic: 'indoor enrichment'
  });

  assert.equal(result.magazineId, 'cat');
  assert.equal(result.magazineName, 'Cat Magazine');
  assert.equal(result.language, 'en-US');
  assert.deepEqual(result.source.seoKeywords, ['cat care', 'enrichment', 'indoor cats']);
  assert.equal((result.metadata?.imageStyle as { mood?: string }).mood, 'warm');
});

test('instagram content service includes image selection reference and alt text', () => {
  const result = new InstagramContentService().generate({
    publishingPackage: createPackageFixture(),
    magazineProfile: createProfileFixture(),
    selectedImage: createImageFixture(),
    topic: 'indoor enrichment'
  });

  assert.equal(result.post.imageSelectionReference, 'cat-image-1:cat-window.jpg');
  assert.match(result.post.altText, /Cat sitting by a window/);
});

function createPackageFixture() {
  return createPublishingPackage({
    article: {
      title: 'Indoor Cat Enrichment Guide',
      summary: 'A practical article summary.',
      body: 'A practical body about indoor cat enrichment.',
      slug: 'indoor-cat-enrichment-guide',
      language: 'en-US',
      author: 'Asteria',
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: [createTag('cat')]
      }
    },
    summary: {
      text: 'A practical summary for indoor cats.'
    },
    seo: {
      metaTitle: 'Indoor Cat Enrichment Guide',
      metaDescription: 'Indoor cat enrichment ideas.',
      keywords: ['cat care', 'indoor cats', 'enrichment']
    },
    faq: [
      {
        question: 'How do I enrich an indoor cat?',
        answer: 'Use play, scent, food puzzles, and safe vertical spaces.'
      }
    ],
    imagePrompt: {
      prompt: 'A calm indoor cat by a window.'
    },
    productPrompt: {
      prompt: 'Cat enrichment products.'
    },
    metadata: {
      dryRun: true
    }
  });
}

function createProfileFixture(): MagazineProfile {
  return {
    id: 'cat',
    name: 'Cat Magazine',
    language: 'en-US',
    audience: 'Cat guardians',
    persona: 'Helpful cat editor',
    tone: 'Warm and practical',
    style: 'magazine',
    promptProfile: 'magazine',
    seoPolicy: {
      primaryKeywordStrategy: 'topic',
      metaDescriptionStyle: 'practical'
    },
    imageStyle: {
      description: 'Bright editorial cat photography',
      preferredOrientation: 'landscape',
      mood: 'warm'
    },
    affiliatePolicy: {
      enabled: true,
      disclosure: 'Mock disclosure',
      preferredCategories: ['cat-care']
    },
    categories: ['cat care', 'indoor cats']
  };
}

function createImageFixture(): ImageAsset {
  return {
    id: 'cat-image-1',
    uri: 'mock://cat-window.jpg',
    metadata: {
      filename: 'cat-window.jpg',
      title: 'Window cat',
      description: 'Cat sitting by a window with toys nearby.',
      tags: ['cat', 'indoor'],
      category: 'hero',
      width: 1200,
      height: 800,
      orientation: 'landscape',
      rating: 5,
      favorite: true,
      source: {
        provider: 'mock',
        externalId: 'cat-image-1'
      },
      checksum: 'cat-image-1'
    }
  };
}
