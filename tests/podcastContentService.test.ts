import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublishingPackage, createTag } from '../src/domain/content/index.ts';
import type { InstagramContentPackage } from '../src/domain/instagram/index.ts';
import type { MagazineProfile } from '../src/domain/magazineProfile/index.ts';
import { PodcastContentService } from '../src/services/podcast/index.ts';

test('podcast content service generates narration script', () => {
  const result = new PodcastContentService().generate({
    publishingPackage: createPackageFixture(),
    magazineProfile: createProfileFixture(),
    instagramPreview: createInstagramFixture()
  });

  assert.match(result.episode.script.narration, /Welcome to Cat Magazine/);
  assert.match(result.episode.script.narration, /Chapter 1: Overview/);
  assert.match(result.episode.script.narration, /Publishing and audio distribution remain disabled/);
});

test('podcast content service generates spoken intro and outro', () => {
  const result = new PodcastContentService().generate({
    publishingPackage: createPackageFixture(),
    magazineProfile: createProfileFixture(),
    instagramPreview: createInstagramFixture()
  });

  assert.match(result.episode.script.spokenIntro, /Today's social hook is/);
  assert.match(result.episode.script.spokenIntro, /Indoor Cat Enrichment Guide/);
  assert.match(result.episode.script.spokenOutro, /Save this cat guide/);
});

test('podcast content service generates chapters', () => {
  const result = new PodcastContentService().generate({
    publishingPackage: createPackageFixture(),
    magazineProfile: createProfileFixture()
  });

  assert.equal(result.episode.script.chapters.length, 3);
  assert.equal(result.episode.script.chapters[0].title, 'Overview');
  assert.equal(result.episode.script.chapters[1].title, 'Key Takeaways');
  assert.equal(result.episode.script.chapters[2].title, 'Listener Question');
});

test('podcast content service estimates duration and TTS segments', () => {
  const result = new PodcastContentService().generate({
    publishingPackage: createPackageFixture(),
    magazineProfile: createProfileFixture(),
    instagramPreview: createInstagramFixture()
  });

  assert.equal(result.ttsRequest.segments.length, 5);
  assert.equal(result.ttsRequest.segments[0].role, 'intro');
  assert.equal(result.ttsRequest.segments.at(-1)?.role, 'outro');
  assert.equal(result.episode.script.estimatedDurationSeconds > 0, true);
  assert.equal(result.ttsRequest.voice, 'warm-editorial-neutral');
});

function createPackageFixture() {
  return createPublishingPackage({
    article: {
      title: 'Indoor Cat Enrichment Guide',
      summary: 'A practical article summary.',
      body: 'Indoor cats need predictable enrichment. Use play sessions, window perches, scent games, and food puzzles. Rotate toys weekly to keep novelty high.',
      slug: 'indoor-cat-enrichment-guide',
      language: 'en-US',
      author: 'Asteria',
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
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

function createInstagramFixture(): InstagramContentPackage {
  return {
    magazineId: 'cat',
    magazineName: 'Cat Magazine',
    topic: 'indoor enrichment',
    language: 'en-US',
    post: {
      caption: {
        short: 'Indoor Cat Enrichment Guide - Warm and practical',
        long: 'Indoor Cat Enrichment Guide\n\nA practical summary.',
        cta: 'Save this cat guide.'
      },
      hashtags: {
        primary: ['#catcare'],
        secondary: ['#indoorcats'],
        branded: ['#CatMagazine']
      },
      altText: 'Cat by a window.',
      imageSelectionReference: 'cat-image-1:cat-window.jpg'
    },
    source: {
      articleTitle: 'Indoor Cat Enrichment Guide',
      seoKeywords: ['cat care']
    }
  };
}
