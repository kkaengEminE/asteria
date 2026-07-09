import type { GeminiConfig } from './GeminiConfig.ts';

export interface GeminiTransportRequest {
  path: string;
  body?: unknown;
}

export interface GeminiTransportResponse {
  status: number;
  body: unknown;
}

export interface GeminiTransport {
  request(config: GeminiConfig, request: GeminiTransportRequest): Promise<GeminiTransportResponse>;
}

export class FetchGeminiTransport implements GeminiTransport {
  async request(config: GeminiConfig, request: GeminiTransportRequest): Promise<GeminiTransportResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    const url = new URL(`${config.baseUrl}${request.path}`);

    url.searchParams.set('key', config.apiKey ?? '');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
