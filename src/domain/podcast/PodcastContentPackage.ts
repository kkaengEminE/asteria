import { createPodcastEpisode, type PodcastEpisode } from './PodcastEpisode.ts';
import { createTTSRequest, type TTSRequest } from './TTSRequest.ts';

export interface PodcastContentPackage {
  episode: PodcastEpisode;
  ttsRequest: TTSRequest;
  source: {
    articleTitle: string;
    magazineId: string;
    instagramShortCaption?: string;
  };
  metadata?: Record<string, unknown>;
}

export class PodcastContentPackageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PodcastContentPackageValidationError';
  }
}

export function createPodcastContentPackage(pkg: PodcastContentPackage): PodcastContentPackage {
  if (!pkg.source.articleTitle || pkg.source.articleTitle.trim().length === 0) {
    throw new PodcastContentPackageValidationError('Podcast content package requires source article title.');
  }

  if (!pkg.source.magazineId || pkg.source.magazineId.trim().length === 0) {
    throw new PodcastContentPackageValidationError('Podcast content package requires source magazine id.');
  }

  return {
    ...pkg,
    episode: createPodcastEpisode(pkg.episode),
    ttsRequest: createTTSRequest(pkg.ttsRequest),
    source: {
      ...pkg.source,
      articleTitle: pkg.source.articleTitle.trim(),
      magazineId: pkg.source.magazineId.trim()
    }
  };
}
