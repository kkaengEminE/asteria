import type { InstagramContentPackage } from '../instagram/index.ts';
import type { PodcastContentPackage } from '../podcast/index.ts';
import type { PreviewSection } from './PreviewSection.ts';

export type ChannelPreviewType = 'instagram' | 'podcast';

export type InstagramChannelPreview = PreviewSection<InstagramContentPackage> & {
  id: 'instagram';
  type: 'channel';
  channel: 'instagram';
};

export type PodcastChannelPreview = PreviewSection<PodcastContentPackage> & {
  id: 'podcast';
  type: 'channel';
  channel: 'podcast';
};

export type ChannelPreview = InstagramChannelPreview | PodcastChannelPreview;
