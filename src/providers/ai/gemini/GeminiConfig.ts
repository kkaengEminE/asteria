export interface GeminiConfig {
  apiKey?: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  productionEnabled: boolean;
}

export interface GeminiEnvironment {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_BASE_URL?: string;
  GEMINI_TIMEOUT_MS?: string;
  GEMINI_PRODUCTION_ENABLED?: string;
}

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

export function createGeminiConfigFromEnv(env: GeminiEnvironment = process.env): GeminiConfig {
  return {
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    baseUrl: env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
    timeoutMs: parseTimeoutMs(env.GEMINI_TIMEOUT_MS),
    productionEnabled: env.GEMINI_PRODUCTION_ENABLED === 'true'
  };
}

export function validateGeminiConfig(config: GeminiConfig): void {
  if (!config.model || config.model.trim().length === 0) {
    throw new GeminiConfigError('Gemini config requires model.');
  }

  if (!config.baseUrl || config.baseUrl.trim().length === 0) {
    throw new GeminiConfigError('Gemini config requires baseUrl.');
  }

  if (config.timeoutMs <= 0) {
    throw new GeminiConfigError('Gemini config timeoutMs must be greater than 0.');
  }
}

function parseTimeoutMs(value: string | undefined): number {
  if (!value) {
    return 30000;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
}
