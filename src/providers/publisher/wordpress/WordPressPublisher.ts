import type { Publisher } from '../../../core/Publisher.ts';
import type { PublishingPayload } from '../../../core/types.ts';
import { createProviderToken } from '../../ProviderToken.ts';
import {
  validateWordPressPublisherConfig,
  type WordPressPublisherConfig
} from './WordPressPublisherConfig.ts';
import { createWordPressPostPayload } from './WordPressPostPayload.ts';
import { createWordPressPreviewResult, type WordPressPublishResult } from './WordPressPublishResult.ts';

export const wordpressPublisherToken = createProviderToken<Publisher>(
  'Publisher',
  'wordpress',
  'WordPress publisher adapter draft.'
);

export class WordPressPublisher implements Publisher {
  readonly name = 'wordpress';
  private readonly config: WordPressPublisherConfig;

  constructor(config: WordPressPublisherConfig) {
    validateWordPressPublisherConfig(config);
    this.config = config;
  }

  async publish(payload: PublishingPayload): Promise<WordPressPublishResult> {
    const post = createWordPressPostPayload(payload, this.config.defaultStatus ?? 'draft');

    return createWordPressPreviewResult(this.config.siteUrl, payload.destination, post);
  }
}

