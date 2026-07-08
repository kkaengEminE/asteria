export interface OpenAIConfig {
  apiKey?: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  productionEnabled: boolean;
  organization?: string;
  project?: string;
}

export interface OpenAIEnvironment {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_TIMEOUT_MS?: string;
  OPENAI_PRODUCTION_ENABLED?: string;
  OPENAI_ORGANIZATION?: string;
  OPENAI_PROJECT?: string;
}

export class OpenAIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIConfigError';
  }
}

export function createOpenAIConfigFromEnv(env: OpenAIEnvironment = process.env): OpenAIConfig {
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL ?? 'gpt-4o-mini',
    baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    timeoutMs: parseTimeoutMs(env.OPENAI_TIMEOUT_MS),
    productionEnabled: env.OPENAI_PRODUCTION_ENABLED === 'true',
    organization: env.OPENAI_ORGANIZATION,
    project: env.OPENAI_PROJECT
  };
}

export function validateOpenAIConfig(config: OpenAIConfig): void {
  if (!config.model || config.model.trim().length === 0) {
    throw new OpenAIConfigError('OpenAI config requires model.');
  }

  if (!config.baseUrl || config.baseUrl.trim().length === 0) {
    throw new OpenAIConfigError('OpenAI config requires baseUrl.');
  }

  if (config.timeoutMs <= 0) {
    throw new OpenAIConfigError('OpenAI config timeoutMs must be greater than 0.');
  }
}

function parseTimeoutMs(value: string | undefined): number {
  if (!value) {
    return 30000;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
}
