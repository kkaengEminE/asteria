import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MagazineTemplate } from './MagazineTemplate.ts';
import { validateMagazineTemplate } from './validateMagazineTemplate.ts';

export interface MagazineTemplateRegistryOptions {
  rootDir?: string;
  fileName?: string;
}

export class MagazineTemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Magazine template not found: ${id}`);
    this.name = 'MagazineTemplateNotFoundError';
  }
}

export class MagazineTemplateLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MagazineTemplateLoadError';
  }
}

export class MagazineTemplateRegistry {
  private readonly templates = new Map<string, MagazineTemplate>();

  register(template: MagazineTemplate): void {
    this.templates.set(template.id, validateMagazineTemplate(template));
  }

  resolve(id: string): MagazineTemplate {
    const template = this.templates.get(id);

    if (!template) {
      throw new MagazineTemplateNotFoundError(id);
    }

    return template;
  }

  has(id: string): boolean {
    return this.templates.has(id);
  }

  list(): MagazineTemplate[] {
    return [...this.templates.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  async loadTemplate(id: string, options: MagazineTemplateRegistryOptions = {}): Promise<MagazineTemplate> {
    const template = await loadMagazineTemplate(id, options);

    this.register(template);
    return template;
  }
}

export async function loadMagazineTemplate(
  id: string,
  options: MagazineTemplateRegistryOptions = {}
): Promise<MagazineTemplate> {
  if (!id || id.includes('/') || id.includes('..')) {
    throw new MagazineTemplateLoadError(`Invalid magazine template id: ${id}`);
  }

  const rootDir = options.rootDir ?? process.cwd();
  const fileName = options.fileName ?? `${id}.example.json`;
  const templatePath = join(rootDir, 'magazines', 'templates', fileName);

  let raw: string;

  try {
    raw = await readFile(templatePath, 'utf8');
  } catch (error) {
    throw new MagazineTemplateLoadError(`Magazine template not found: ${id}`, { cause: error });
  }

  try {
    return validateMagazineTemplate(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new MagazineTemplateLoadError(`Magazine template contains invalid JSON: ${templatePath}`, { cause: error });
    }

    throw error;
  }
}
