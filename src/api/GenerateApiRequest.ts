export interface GenerateApiRequest {
  topic: string;
  magazine?: string;
  language?: string;
  provider?: GenerateApiProvider;
}

export type GenerateApiProvider = 'mock' | 'gemini' | 'openai';

export function validateGenerateApiRequest(value: unknown): GenerateApiRequest {
  if (!isObject(value)) {
    throw new GenerateApiRequestError('Request body must be a JSON object.');
  }

  const topic = parseRequiredString(value.topic, 'topic');
  const magazine = parseOptionalString(value.magazine, 'magazine');
  const language = parseOptionalString(value.language, 'language');
  const provider = parseOptionalProvider(value.provider);

  return {
    topic,
    magazine,
    language,
    provider
  };
}

export class GenerateApiRequestError extends Error {
  readonly code = 'generate_api_request_error';
}

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GenerateApiRequestError(`${field} is required.`);
  }

  return value.trim();
}

function parseOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new GenerateApiRequestError(`${field} must be a string when provided.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalProvider(value: unknown): GenerateApiProvider | undefined {
  const provider = parseOptionalString(value, 'provider');

  if (provider === undefined) {
    return undefined;
  }

  if (provider !== 'mock' && provider !== 'gemini' && provider !== 'openai') {
    throw new GenerateApiRequestError('provider must be one of: mock, gemini, openai.');
  }

  return provider;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
