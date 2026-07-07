import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MagazineConfig } from '../core/MagazineConfig.ts';
import { validateMagazineConfig } from './validateMagazineConfig.ts';

export interface LoadMagazineConfigOptions {
  rootDir?: string;
  fileName?: string;
}

export class MagazineConfigLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MagazineConfigLoadError';
  }
}

export async function loadMagazineConfig(
  slug: string,
  options: LoadMagazineConfigOptions = {}
): Promise<MagazineConfig> {
  if (!slug || slug.includes('/') || slug.includes('..')) {
    throw new MagazineConfigLoadError(`Invalid magazine slug: ${slug}`);
  }

  const rootDir = options.rootDir ?? process.cwd();
  const fileName = options.fileName ?? 'config.example.json';
  const configPath = join(rootDir, 'magazines', slug, fileName);

  let raw: string;

  try {
    raw = await readFile(configPath, 'utf8');
  } catch (error) {
    throw new MagazineConfigLoadError(`Magazine config not found for slug: ${slug}`, { cause: error });
  }

  try {
    return validateMagazineConfig(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new MagazineConfigLoadError(`Magazine config contains invalid JSON: ${configPath}`, { cause: error });
    }

    throw error;
  }
}

