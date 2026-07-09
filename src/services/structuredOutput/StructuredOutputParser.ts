import { createPublishingPackage, type PublishingPackage } from '../../domain/content/index.ts';
import { StructuredOutputError } from './StructuredOutputError.ts';
import {
  StructuredOutputValidator,
  type StructuredOutputValidationResult
} from './StructuredOutputValidator.ts';

export interface StructuredOutputParseResult {
  publishingPackage: PublishingPackage;
  validation: StructuredOutputValidationResult;
}

export class StructuredOutputParser {
  private readonly validator: StructuredOutputValidator;

  constructor(validator = new StructuredOutputValidator()) {
    this.validator = validator;
  }

  parsePublishingPackage(value: unknown): StructuredOutputParseResult {
    const normalized = normalizeStructuredOutput(coerceStructuredValue(value));
    const validation = this.validator.validatePublishingPackage(normalized);

    if (!validation.valid) {
      throw new StructuredOutputError({
        code: validation.errors.some((error) => error.includes('requires')) ? 'MissingRequiredField' : 'ValidationFailed',
        message: 'Publishing package structured output validation failed.',
        details: validation.errors
      });
    }

    return {
      publishingPackage: createPublishingPackage(normalized as PublishingPackage),
      validation
    };
  }
}

export function normalizeStructuredOutput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeStructuredOutput);
  }

  if (!isRecord(value)) {
    return typeof value === 'string' ? normalizeWhitespace(value) : value;
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    normalized[key] = normalizeStructuredOutput(item);
  }

  if (Array.isArray(normalized.faq)) {
    normalized.faq = deduplicateFaq(normalized.faq);
  }

  return normalized;
}

function coerceStructuredValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    if (value === undefined || value === null) {
      throw new StructuredOutputError({
        code: 'EmptyResponse',
        message: 'Structured output response was empty.'
      });
    }

    return value;
  }

  if (value.trim().length === 0) {
    throw new StructuredOutputError({
      code: 'EmptyResponse',
      message: 'Structured output response was empty.'
    });
  }

  try {
    return JSON.parse(extractJsonObjectText(value));
  } catch (error) {
    throw new StructuredOutputError({
      code: 'InvalidJson',
      message: `Structured output response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

function extractJsonObjectText(content: string): string {
  const trimmed = stripMarkdownFence(content.trim());
  const start = trimmed.indexOf('{');

  if (start < 0) {
    return trimmed;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return trimmed.slice(start, index + 1);
      }
    }
  }

  return trimmed.slice(start);
}

function stripMarkdownFence(value: string): string {
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : value;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function deduplicateFaq(items: unknown[]): unknown[] {
  const seen = new Set<string>();
  const result: unknown[] = [];

  for (const item of items) {
    if (!isRecord(item)) {
      result.push(item);
      continue;
    }

    const question = typeof item.question === 'string' ? normalizeWhitespace(item.question).toLowerCase() : '';

    if (question && seen.has(question)) {
      continue;
    }

    if (question) {
      seen.add(question);
    }

    result.push(item);
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
