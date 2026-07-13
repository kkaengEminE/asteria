import type { AudioAsset } from './types';
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
  publishEpisode(payload: PodcastEpisodePayload): Promise<PodcastPublishResult>;
}

export interface PodcastPublishResult {
  status: 'draft' | 'published' | 'scheduled' | 'skipped' | 'failed';
  destination?: string;
  url?: string;
  externalId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}
