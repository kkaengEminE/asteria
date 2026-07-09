import { DEFAULT_PROMPT_VERSION, type PromptVersion } from './PromptVersion.ts';
import type { PromptAssetRegistry } from './PromptAssetRegistry.ts';
import type { PromptVariables } from './PromptVariables.ts';
import { resolvePromptProfile, type PromptProfileName } from './PromptProfile.ts';
import type { RenderedPrompt } from './PromptDefinition.ts';

export interface ComposePromptOptions {
  registry: PromptAssetRegistry;
  profile?: PromptProfileName;
  version?: PromptVersion;
  variables: PromptVariables;
}

export interface ComposedPrompt {
  profile: string;
  version: PromptVersion;
  promptIds: string[];
  renderedPrompts: RenderedPrompt[];
  rendered: string;
  variables: PromptVariables;
}

export function composePrompt(options: ComposePromptOptions): ComposedPrompt {
  const profile = resolvePromptProfile(options.profile);
  const version = options.version ?? DEFAULT_PROMPT_VERSION;
  const renderedPrompts = profile.promptIds.map((promptId) =>
    options.registry.resolve(promptId, version).render(options.variables)
  );

  return {
    profile: profile.name,
    version,
    promptIds: profile.promptIds,
    renderedPrompts,
    rendered: renderedPrompts.map(formatRenderedPrompt).join('\n\n---\n\n'),
    variables: options.variables
  };
}

function formatRenderedPrompt(prompt: RenderedPrompt): string {
  return [`# ${prompt.id}@${prompt.version}`, prompt.rendered].join('\n');
}
