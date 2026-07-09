import type { PromptAsset } from './PromptAsset.ts';
import type { PromptMetadata } from './PromptMetadata.ts';
import type { PromptVariables } from './PromptVariables.ts';

export interface PromptDefinition {
  asset: PromptAsset;
  metadata: PromptMetadata;
  render(variables: PromptVariables): RenderedPrompt;
}

export interface RenderedPrompt {
  id: string;
  version: string;
  rendered: string;
  variables: PromptVariables;
  metadata: PromptMetadata;
}
