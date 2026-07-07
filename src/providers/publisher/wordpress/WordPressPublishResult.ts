import type { PublishingDestination, PublishingResult } from '../../../core/types.ts';
import type { WordPressPostPayload } from './WordPressPostPayload.ts';

export interface WordPressPublishResult extends PublishingResult {
  status: 'draft';
  metadata: {
    provider: 'wordpress';
    dryRun: true;
    post: WordPressPostPayload;
    siteUrl: string;
  };
}

export function createWordPressPreviewResult(
  siteUrl: string,
  destination: PublishingDestination,
  post: WordPressPostPayload
): WordPressPublishResult {
  return {
    status: 'draft',
    destination,
    externalId: `wordpress-preview-${post.slug ?? slugify(post.title)}`,
    message: `WordPress dry-run preview created for "${post.title}". Nothing was published.`,
    metadata: {
      provider: 'wordpress',
      dryRun: true,
      post,
      siteUrl
    }
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

