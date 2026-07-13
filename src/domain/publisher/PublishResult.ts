import type { PublishingDestination } from '../publishingQueue/index.ts';
import type { PublishFailure } from './PublishFailure.ts';
import type { PublishMode } from './PublishRequest.ts';
import type { PublishStatus } from './PublishStatus.ts';

export interface PublishResult {
  status: PublishStatus;
  publisher: string;
  mode: PublishMode;
  destination: PublishingDestination;
  publishId?: string;
  previewUrl?: string;
  failure?: PublishFailure;
  message: string;
  metadata?: Record<string, unknown>;
}
