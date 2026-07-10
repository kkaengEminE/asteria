import type { MagazineTemplate } from './MagazineTemplate.ts';

export class MagazineTemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MagazineTemplateValidationError';
  }
}

export function validateMagazineTemplate(value: unknown): MagazineTemplate {
  if (!isRecord(value)) {
    throw new MagazineTemplateValidationError('Magazine template must be a JSON object.');
  }

  if (!isNonEmptyString(value.id)) {
    throw new MagazineTemplateValidationError('Missing or invalid required field: id');
  }

  if (!isNonEmptyString(value.persona)) {
    throw new MagazineTemplateValidationError('Missing or invalid required field: persona');
  }

  if (!isNonEmptyString(value.tone)) {
    throw new MagazineTemplateValidationError('Missing or invalid required field: tone');
  }

  if (!isNonEmptyString(value.promptProfile)) {
    throw new MagazineTemplateValidationError('Missing or invalid required field: promptProfile');
  }

  if (!isRecord(value.seoPolicy)) {
    throw new MagazineTemplateValidationError('Missing or invalid required field: seoPolicy');
  }

  if (!isRecord(value.reviewPolicy)) {
    throw new MagazineTemplateValidationError('Missing or invalid required field: reviewPolicy');
  }

  if (!isRecord(value.imagePolicy)) {
    throw new MagazineTemplateValidationError('Missing or invalid required field: imagePolicy');
  }

  if (!isRecord(value.affiliatePolicy)) {
    throw new MagazineTemplateValidationError('Missing or invalid required field: affiliatePolicy');
  }

  if (value.metadata !== undefined && !isRecord(value.metadata)) {
    throw new MagazineTemplateValidationError('Invalid optional field: metadata');
  }

  const template = value as unknown as MagazineTemplate;

  return {
    id: template.id.trim(),
    persona: template.persona.trim(),
    tone: template.tone.trim(),
    promptProfile: template.promptProfile.trim(),
    seoPolicy: {
      primaryKeywordStrategy: template.seoPolicy.primaryKeywordStrategy.trim(),
      metaDescriptionStyle: template.seoPolicy.metaDescriptionStyle.trim(),
      keywordCount: template.seoPolicy.keywordCount
    },
    reviewPolicy: {
      minimumQualityScore: template.reviewPolicy.minimumQualityScore,
      minimumReviewScore: template.reviewPolicy.minimumReviewScore,
      minimumArticleWords: template.reviewPolicy.minimumArticleWords
    },
    imagePolicy: {
      description: template.imagePolicy.description.trim(),
      preferredOrientation: template.imagePolicy.preferredOrientation?.trim(),
      mood: template.imagePolicy.mood?.trim()
    },
    affiliatePolicy: {
      enabled: template.affiliatePolicy.enabled,
      disclosure: template.affiliatePolicy.disclosure.trim(),
      preferredCategories: template.affiliatePolicy.preferredCategories.map((category) => category.trim())
    },
    metadata: template.metadata
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
