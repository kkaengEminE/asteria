import type { PublishingPayload } from '../../../core/types.ts';

export interface WordPressPostPayload {
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  status: 'draft' | 'pending' | 'private';
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class WordPressPostPayloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordPressPostPayloadValidationError';
  }
}

export function createWordPressPostPayload(
  payload: PublishingPayload,
  defaultStatus: WordPressPostPayload['status'] = 'draft'
): WordPressPostPayload {
  const postPayload: WordPressPostPayload = {
    title: payload.draft.title,
    content: payload.draft.body,
    excerpt: payload.draft.summary,
    slug: payload.draft.slug,
    status: defaultStatus,
    tags: payload.draft.tags,
    metadata: {
      ...payload.metadata,
      destination: payload.destination,
      images: payload.images,
      affiliateLinks: payload.affiliateLinks
    }
  };

  validateWordPressPostPayload(postPayload);

  return postPayload;
}

export function validateWordPressPostPayload(payload: WordPressPostPayload): void {
  if (!payload.title || payload.title.trim().length === 0) {
    throw new WordPressPostPayloadValidationError('WordPress post payload requires title.');
  }

  if (!payload.content || payload.content.trim().length === 0) {
    throw new WordPressPostPayloadValidationError('WordPress post payload requires content.');
  }
}

