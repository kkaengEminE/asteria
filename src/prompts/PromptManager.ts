import { PromptLoader } from './PromptLoader.ts';
import { PromptRegistry } from './PromptRegistry.ts';
import type { PromptTemplate } from './PromptTemplate.ts';
import type { PromptVariables } from './PromptVariables.ts';

export interface PromptManagerOptions {
  loader?: PromptLoader;
  registry?: PromptRegistry;
}

export interface LoadPromptSetOptions {
  magazineSlug?: string;
}

export class PromptManager {
  private readonly loader: PromptLoader;
  private readonly registry: PromptRegistry;

  constructor(options: PromptManagerOptions = {}) {
    this.loader = options.loader ?? new PromptLoader();
    this.registry = options.registry ?? new PromptRegistry();
  }

  async load(options: LoadPromptSetOptions = {}): Promise<void> {
    const sharedPrompts = await this.loader.loadSharedPrompts();

    for (const prompt of sharedPrompts) {
      this.registry.register(prompt);
    }

    if (options.magazineSlug) {
      const magazinePrompts = await this.loader.loadMagazinePrompts(options.magazineSlug);

      for (const prompt of magazinePrompts) {
        this.registry.register(prompt);
      }
    }
  }

  register(prompt: PromptTemplate): void {
    this.registry.register(prompt);
  }

  get(key: string): PromptTemplate {
    return this.registry.get(key);
  }

  has(key: string): boolean {
    return this.registry.has(key);
  }

  list(): PromptTemplate[] {
    return this.registry.list();
  }

  render(key: string, variables: PromptVariables): string {
    return this.get(key).render(variables);
  }
}
