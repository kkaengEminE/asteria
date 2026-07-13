import type { PublishingPackage } from '../content/index.ts';
import type { PublishingDestination } from '../publishingQueue/index.ts';

export type PublishMode = 'preview' | 'production';

export interface PublishRequest {
  publishingPackage: PublishingPackage;
  destination: PublishingDestination;
  mode?: PublishMode;
  requestedAt?: string;
  metadata?: Record<string, unknown>;
}
