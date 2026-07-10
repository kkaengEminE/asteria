import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MagazineProfile } from './MagazineProfile.ts';
import { validateMagazineProfile } from './validateMagazineProfile.ts';
import type { MagazineTemplate } from '../magazineTemplate/MagazineTemplate.ts';
import { loadMagazineTemplate } from '../magazineTemplate/MagazineTemplateRegistry.ts';

export interface MagazineProfileRegistryOptions {
  rootDir?: string;
  fileName?: string;
}

export class MagazineProfileNotFoundError extends Error {
  constructor(id: string) {
    super(`Magazine profile not found: ${id}`);
    this.name = 'MagazineProfileNotFoundError';
  }
}

export class MagazineProfileLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MagazineProfileLoadError';
  }
}

export class MagazineProfileRegistry {
  private readonly profiles = new Map<string, MagazineProfile>();

  register(profile: MagazineProfile): void {
    this.profiles.set(profile.id, validateMagazineProfile(profile));
  }

  resolve(id: string): MagazineProfile {
    const profile = this.profiles.get(id);

    if (!profile) {
      throw new MagazineProfileNotFoundError(id);
    }

    return profile;
  }

  has(id: string): boolean {
    return this.profiles.has(id);
  }

  list(): MagazineProfile[] {
    return [...this.profiles.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  async loadProfile(id: string, options: MagazineProfileRegistryOptions = {}): Promise<MagazineProfile> {
    const profile = await loadMagazineProfile(id, options);

    this.register(profile);
    return profile;
  }
}

export async function loadMagazineProfile(
  id: string,
  options: MagazineProfileRegistryOptions = {}
): Promise<MagazineProfile> {
  if (!id || id.includes('/') || id.includes('..')) {
    throw new MagazineProfileLoadError(`Invalid magazine profile id: ${id}`);
  }

  const rootDir = options.rootDir ?? process.cwd();
  const fileName = options.fileName ?? 'profile.example.json';
  const profilePath = join(rootDir, 'magazines', id, fileName);

  let raw: string;

  try {
    raw = await readFile(profilePath, 'utf8');
  } catch (error) {
    throw new MagazineProfileLoadError(`Magazine profile not found: ${id}`, { cause: error });
  }

  try {
    const profile = JSON.parse(raw);
    const template = await loadProfileTemplate(profile, rootDir);

    return validateMagazineProfile(mergeTemplateWithProfile(template, profile));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new MagazineProfileLoadError(`Magazine profile contains invalid JSON: ${profilePath}`, { cause: error });
    }

    throw error;
  }
}

async function loadProfileTemplate(profile: unknown, rootDir: string): Promise<MagazineTemplate | undefined> {
  if (!isRecord(profile) || typeof profile.template !== 'string' || profile.template.trim().length === 0) {
    return undefined;
  }

  return loadMagazineTemplate(profile.template.trim(), { rootDir });
}

function mergeTemplateWithProfile(template: MagazineTemplate | undefined, profile: unknown): unknown {
  if (!template || !isRecord(profile)) {
    return profile;
  }

  const templateDefaults = {
    persona: template.persona,
    tone: template.tone,
    style: template.promptProfile,
    promptProfile: template.promptProfile,
    seoPolicy: template.seoPolicy,
    reviewPolicy: template.reviewPolicy,
    imageStyle: template.imagePolicy,
    affiliatePolicy: template.affiliatePolicy
  };

  return {
    ...templateDefaults,
    ...profile,
    seoPolicy: {
      ...template.seoPolicy,
      ...(isRecord(profile.seoPolicy) ? profile.seoPolicy : {})
    },
    reviewPolicy: {
      ...template.reviewPolicy,
      ...(isRecord(profile.reviewPolicy) ? profile.reviewPolicy : {})
    },
    imageStyle: {
      ...template.imagePolicy,
      ...(isRecord(profile.imageStyle) ? profile.imageStyle : {}),
      ...(isRecord(profile.imagePolicy) ? profile.imagePolicy : {})
    },
    affiliatePolicy: {
      ...template.affiliatePolicy,
      ...(isRecord(profile.affiliatePolicy) ? profile.affiliatePolicy : {})
    },
    metadata: {
      template: template.id,
      ...(isRecord(template.metadata) ? template.metadata : {}),
      ...(isRecord(profile.metadata) ? profile.metadata : {})
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
