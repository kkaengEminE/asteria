export type PromptVersion = `v${number}` | string;

export const DEFAULT_PROMPT_VERSION: PromptVersion = 'v1';

export interface PromptVersionMetadata {
  promptVersion: PromptVersion;
}
