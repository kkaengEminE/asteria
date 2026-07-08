import type { OpenAIConfig } from './OpenAIConfig.ts';

export interface OpenAITransportRequest {
  path: string;
  body?: unknown;
}

export interface OpenAITransportResponse {
  status: number;
  body: unknown;
}

export interface OpenAITransport {
  request(config: OpenAIConfig, request: OpenAITransportRequest): Promise<OpenAITransportResponse>;
}

export class FetchOpenAITransport implements OpenAITransport {
  async request(config: OpenAIConfig, request: OpenAITransportRequest): Promise<OpenAITransportResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${config.baseUrl}${request.path}`, {
        method: 'POST',
        headers: createHeaders(config),
        body: JSON.stringify(request.body ?? {}),
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));

      return {
        status: response.status,
        body
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function createHeaders(config: OpenAIConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey ?? ''}`
  };

  if (config.organization) {
    headers['OpenAI-Organization'] = config.organization;
  }

  if (config.project) {
    headers['OpenAI-Project'] = config.project;
  }

  return headers;
}
