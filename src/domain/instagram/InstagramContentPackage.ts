import { createInstagramCaption, type InstagramCaption } from './InstagramCaption.ts';
import { createInstagramHashtagSet, type InstagramHashtagSet } from './InstagramHashtagSet.ts';

export interface InstagramContentPackage {
  magazineId: string;
  magazineName: string;
  topic: string;
  language: string;
  post: {
    caption: InstagramCaption;
    hashtags: InstagramHashtagSet;
    altText: string;
    imageSelectionReference?: string;
  };
  source: {
    articleTitle: string;
    seoKeywords: string[];
  };
  metadata?: Record<string, unknown>;
}

export class InstagramContentPackageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstagramContentPackageValidationError';
  }
}

export function createInstagramContentPackage(pkg: InstagramContentPackage): InstagramContentPackage {
  if (!pkg.magazineId || pkg.magazineId.trim().length === 0) {
    throw new InstagramContentPackageValidationError('Instagram content package requires magazineId.');
  }

  if (!pkg.magazineName || pkg.magazineName.trim().length === 0) {
    throw new InstagramContentPackageValidationError('Instagram content package requires magazineName.');
  }

  if (!pkg.topic || pkg.topic.trim().length === 0) {
    throw new InstagramContentPackageValidationError('Instagram content package requires topic.');
  }

  if (!pkg.language || pkg.language.trim().length === 0) {
    throw new InstagramContentPackageValidationError('Instagram content package requires language.');
  }

  if (!pkg.post.altText || pkg.post.altText.trim().length === 0) {
    throw new InstagramContentPackageValidationError('Instagram content package requires alt text.');
  }

  return {
    ...pkg,
    magazineId: pkg.magazineId.trim(),
    magazineName: pkg.magazineName.trim(),
    topic: pkg.topic.trim(),
    language: pkg.language.trim(),
    post: {
      ...pkg.post,
      caption: createInstagramCaption(pkg.post.caption),
      hashtags: createInstagramHashtagSet(pkg.post.hashtags),
      altText: pkg.post.altText.trim()
    },
    source: {
      articleTitle: pkg.source.articleTitle.trim(),
      seoKeywords: [...pkg.source.seoKeywords]
    }
  };
}
