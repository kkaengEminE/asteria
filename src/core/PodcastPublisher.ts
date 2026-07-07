import type { AudioAsset, PublishingResult } from './types';
import type { MagazineConfig } from './MagazineConfig';

export interface PodcastEpisodePayload {
  magazine: MagazineConfig;
  title: string;
  description?: string;
  audio: AudioAsset;
  metadata?: Record<string, unknown>;
}

export interface PodcastPublisher {
  readonly name: string;
  publishEpisode(payload: PodcastEpisodePayload): Promise<PublishingResult>;
}

