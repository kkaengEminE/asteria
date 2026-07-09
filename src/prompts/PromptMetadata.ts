import type { PromptId } from './PromptId.ts';
import type { PromptVersion } from './PromptVersion.ts';

export interface PromptMetadata {
  id: PromptId;
  version: PromptVersion;
  description?: string;
  source?: string;
  variables: string[];
}
