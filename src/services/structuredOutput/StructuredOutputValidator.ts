import { createPublishingPackage, type PublishingPackage } from '../../domain/content/index.ts';
import { StructuredOutputError } from './StructuredOutputError.ts';

export interface StructuredOutputValidationResult {
  valid: boolean;
  errors: string[];
}

export class StructuredOutputValidator {
  validatePublishingPackage(value: unknown): StructuredOutputValidationResult {
    const errors = collectPublishingPackageSchemaErrors(value);

    if (errors.length > 0) {
      return {
        valid: false,
        errors
      };
    }

    try {
      createPublishingPackage(value as PublishingPackage);
      return {
        valid: true,
        errors: []
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  assertPublishingPackage(value: unknown): void {
    const result = this.validatePublishingPackage(value);

    if (!result.valid) {
      throw new StructuredOutputError({
        code: result.errors.some((error) => error.includes('requires')) ? 'MissingRequiredField' : 'ValidationFailed',
        message: 'Publishing package structured output validation failed.',
        details: result.errors
      });
    }
  }
}

export function collectPublishingPackageSchemaErrors(value: unknown): string[] {
  if (!isRecord(value)) {
    return ['Publishing package must be an object.'];
  }

  const errors: string[] = [];

  requireObject(value, 'article', errors);
  requireObject(value, 'summary', errors);
  requireObject(value, 'seo', errors);
  requireArray(value, 'faq', errors);
  requireObject(value, 'imagePrompt', errors);
  requireObject(value, 'productPrompt', errors);

  if (isRecord(value.article)) {
    requireString(value.article, 'article.title', 'title', errors);
    requireString(value.article, 'article.summary', 'summary', errors);
    requireString(value.article, 'article.body', 'body', errors);
    requireString(value.article, 'article.language', 'language', errors);
    requireString(value.article, 'article.createdAt', 'createdAt', errors);
  }

  if (isRecord(value.summary)) {
    requireString(value.summary, 'summary.text', 'text', errors);
  }

  if (isRecord(value.seo)) {
    requireString(value.seo, 'seo.metaTitle', 'metaTitle', errors);
    requireString(value.seo, 'seo.metaDescription', 'metaDescription', errors);
    if (!Array.isArray(value.seo.keywords)) {
      errors.push('Publishing package requires seo.keywords.');
    }
  }

  if (Array.isArray(value.faq)) {
    if (value.faq.length === 0) {
      errors.push('Publishing package requires at least one faq item.');
    }

    value.faq.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`Publishing package faq[${index}] must be an object.`);
        return;
      }

      requireString(item, `faq[${index}].question`, 'question', errors);
      requireString(item, `faq[${index}].answer`, 'answer', errors);
    });
  }

  if (isRecord(value.imagePrompt)) {
    requireString(value.imagePrompt, 'imagePrompt.prompt', 'prompt', errors);
  }

  if (isRecord(value.productPrompt)) {
    requireString(value.productPrompt, 'productPrompt.prompt', 'prompt', errors);
  }

  return errors;
}

function requireObject(value: Record<string, unknown>, key: string, errors: string[]): void {
  if (!isRecord(value[key])) {
    errors.push(`Publishing package requires ${key}.`);
  }
}

function requireArray(value: Record<string, unknown>, key: string, errors: string[]): void {
  if (!Array.isArray(value[key])) {
    errors.push(`Publishing package requires ${key}.`);
  }
}

function requireString(
  value: Record<string, unknown>,
  label: string,
  key: string,
  errors: string[]
): void {
  if (typeof value[key] !== 'string' || value[key].trim().length === 0) {
    errors.push(`Publishing package requires ${label}.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
