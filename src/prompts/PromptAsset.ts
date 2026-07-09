import type { PromptId } from './PromptId.ts';
import type { PromptVersion } from './PromptVersion.ts';

export interface PromptAsset {
  id: PromptId;
  version: PromptVersion;
  template: string;
  description?: string;
  source?: string;
}
