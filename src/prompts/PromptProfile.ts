export type PromptProfileName = 'default' | 'blog' | 'magazine' | string;

export interface PromptProfile {
  name: PromptProfileName;
  promptIds: string[];
}

const profiles: Record<string, PromptProfile> = {
  default: {
    name: 'default',
    promptIds: [
      'content.system',
      'content.persona',
      'content.style.default',
      'content.task',
      'content.outputSchema'
    ]
  },
  blog: {
    name: 'blog',
    promptIds: [
      'content.system',
      'content.persona',
      'content.style.blog',
      'content.task',
      'content.outputSchema'
    ]
  },
  magazine: {
    name: 'magazine',
    promptIds: [
      'content.system',
      'content.persona',
      'content.style.magazine',
      'content.task',
      'content.outputSchema'
    ]
  }
};

export function resolvePromptProfile(name: PromptProfileName | undefined): PromptProfile {
  return profiles[name ?? 'default'] ?? profiles.default;
}
