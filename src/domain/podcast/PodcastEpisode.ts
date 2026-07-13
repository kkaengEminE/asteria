import type { PodcastScript } from './PodcastScript.ts';

export interface PodcastEpisode {
  title: string;
  description: string;
  language: string;
  magazineName: string;
  script: PodcastScript;
  metadata?: Record<string, unknown>;
}

export class PodcastEpisodeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PodcastEpisodeValidationError';
  }
}

export function createPodcastEpisode(episode: PodcastEpisode): PodcastEpisode {
  if (!episode.title || episode.title.trim().length === 0) {
    throw new PodcastEpisodeValidationError('Podcast episode requires title.');
  }

  if (!episode.description || episode.description.trim().length === 0) {
    throw new PodcastEpisodeValidationError('Podcast episode requires description.');
  }

  if (!episode.language || episode.language.trim().length === 0) {
    throw new PodcastEpisodeValidationError('Podcast episode requires language.');
  }

  if (!episode.magazineName || episode.magazineName.trim().length === 0) {
    throw new PodcastEpisodeValidationError('Podcast episode requires magazine name.');
  }

  return {
    ...episode,
    title: episode.title.trim(),
    description: episode.description.trim(),
    language: episode.language.trim(),
    magazineName: episode.magazineName.trim()
  };
}
