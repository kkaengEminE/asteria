import type { PromptTemplate } from './PromptTemplate.ts';

export class PromptNotFoundError extends Error {
  constructor(key: string) {
    super(`Prompt not found: ${key}`);
    this.name = 'PromptNotFoundError';
  }
}

export class PromptRegistry {
  private readonly prompts = new Map<string, PromptTemplate>();

  register(prompt: PromptTemplate): void {
    this.prompts.set(prompt.key, prompt);
  }

  get(key: string): PromptTemplate {
    const prompt = this.prompts.get(key);

    if (!prompt) {
      throw new PromptNotFoundError(key);
    }

    return prompt;
  }

  has(key: string): boolean {
    return this.prompts.has(key);
  }

  list(): PromptTemplate[] {
    return [...this.prompts.values()];
  }
}

