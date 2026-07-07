import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PromptTemplate } from './PromptTemplate.ts';

export interface PromptLoaderOptions {
  rootDir?: string;
  extension?: string;
}

export class PromptLoader {
  private readonly rootDir: string;
  private readonly extension: string;

  constructor(options: PromptLoaderOptions = {}) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.extension = options.extension ?? '.md';
  }

  async loadSharedPrompts(): Promise<PromptTemplate[]> {
    return this.loadPromptDirectory(join(this.rootDir, 'prompts', 'shared'), 'shared');
  }

  async loadMagazinePrompts(magazineSlug: string): Promise<PromptTemplate[]> {
    return this.loadPromptDirectory(join(this.rootDir, 'prompts', 'magazines', magazineSlug), 'magazine');
  }

  private async loadPromptDirectory(directoryPath: string, source: 'shared' | 'magazine'): Promise<PromptTemplate[]> {
    let entries: string[];

    try {
      entries = await readdir(directoryPath);
    } catch {
      return [];
    }

    const promptFiles = entries.filter((entry) => entry.endsWith(this.extension)).sort();

    return Promise.all(
      promptFiles.map(async (fileName) => {
        const filePath = join(directoryPath, fileName);
        const content = await readFile(filePath, 'utf8');
        const key = fileName.slice(0, -this.extension.length);

        return new PromptTemplate({
          key,
          content,
          source,
          path: filePath
        });
      })
    );
  }
}

