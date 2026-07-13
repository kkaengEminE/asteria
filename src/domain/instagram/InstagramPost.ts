import type { InstagramCaption } from './InstagramCaption.ts';
import type { InstagramHashtagSet } from './InstagramHashtagSet.ts';

export interface InstagramPost {
  caption: InstagramCaption;
  hashtags: InstagramHashtagSet;
  altText: string;
  imageSelectionReference?: string;
  metadata?: Record<string, unknown>;
}
