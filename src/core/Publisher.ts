import type { PublishingPayload, PublishingResult } from './types';

export interface Publisher {
  readonly name: string;
  publish(payload: PublishingPayload): Promise<PublishingResult>;
}

