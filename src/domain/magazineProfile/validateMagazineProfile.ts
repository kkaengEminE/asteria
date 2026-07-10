import type {
  MagazineAffiliatePolicy,
  MagazineImageStyle,
  MagazineProfile,
  MagazineSeoPolicy
} from './MagazineProfile.ts';

export class MagazineProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MagazineProfileValidationError';
  }
}

const requiredStringFields = [
  'id',
  'name',
  'language',
  'audience',
  'persona',
  'tone',
  'style'
] as const;

export function validateMagazineProfile(value: unknown): MagazineProfile {
  if (!isRecord(value)) {
    throw new MagazineProfileValidationError('Magazine profile must be a JSON object.');
  }

  for (const field of requiredStringFields) {
    if (!isNonEmptyString(value[field])) {
      throw new MagazineProfileValidationError(`Missing or invalid required field: ${field}`);
    }
  }

  if (!isSeoPolicy(value.seoPolicy)) {
    throw new MagazineProfileValidationError('Missing or invalid required field: seoPolicy');
  }

  if (!isImageStyle(value.imageStyle)) {
    throw new MagazineProfileValidationError('Missing or invalid required field: imageStyle');
  }

  if (!isAffiliatePolicy(value.affiliatePolicy)) {
    throw new MagazineProfileValidationError('Missing or invalid required field: affiliatePolicy');
  }

  if (!isStringArray(value.categories)) {
    throw new MagazineProfileValidationError('Missing or invalid required field: categories');
  }

  if (value.metadata !== undefined && !isRecord(value.metadata)) {
    throw new MagazineProfileValidationError('Invalid optional field: metadata');
  }

  const profile = value as unknown as MagazineProfile;

  return {
    id: profile.id.trim(),
    template: profile.template?.trim(),
    name: profile.name.trim(),
    language: profile.language.trim(),
    audience: profile.audience.trim(),
    persona: profile.persona.trim(),
    tone: profile.tone.trim(),
    style: profile.style.trim(),
    promptProfile: profile.promptProfile?.trim(),
    seoPolicy: {
      primaryKeywordStrategy: profile.seoPolicy.primaryKeywordStrategy.trim(),
      metaDescriptionStyle: profile.seoPolicy.metaDescriptionStyle.trim(),
      keywordCount: profile.seoPolicy.keywordCount
    },
    reviewPolicy: profile.reviewPolicy,
    imageStyle: {
      description: profile.imageStyle.description.trim(),
      preferredOrientation: profile.imageStyle.preferredOrientation?.trim(),
      mood: profile.imageStyle.mood?.trim()
    },
    affiliatePolicy: {
      enabled: profile.affiliatePolicy.enabled,
      disclosure: profile.affiliatePolicy.disclosure.trim(),
      preferredCategories: profile.affiliatePolicy.preferredCategories.map((category) => category.trim())
    },
    categories: profile.categories.map((category) => category.trim()),
    metadata: profile.metadata
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function isSeoPolicy(value: unknown): value is MagazineSeoPolicy {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.primaryKeywordStrategy) &&
    isNonEmptyString(value.metaDescriptionStyle) &&
    (value.keywordCount === undefined || typeof value.keywordCount === 'number')
  );
}

function isImageStyle(value: unknown): value is MagazineImageStyle {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.description) &&
    (value.preferredOrientation === undefined || isNonEmptyString(value.preferredOrientation)) &&
    (value.mood === undefined || isNonEmptyString(value.mood))
  );
}

function isAffiliatePolicy(value: unknown): value is MagazineAffiliatePolicy {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.enabled === 'boolean' &&
    isNonEmptyString(value.disclosure) &&
    isStringArray(value.preferredCategories)
  );
}
