import type { PublishRequest } from './PublishRequest.ts';
import type { PublishResult } from './PublishResult.ts';

export interface Publisher {
  readonly name: string;
  readonly mode?: 'dry-run' | 'production-capable';
  publish(request: PublishRequest): Promise<PublishResult>;
}
