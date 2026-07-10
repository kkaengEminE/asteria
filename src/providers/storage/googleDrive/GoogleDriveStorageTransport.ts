import type { GoogleDriveStorageProviderConfig } from './GoogleDriveStorageProviderConfig.ts';

export interface GoogleDriveTransportRequest {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  upload?: boolean;
}

export interface GoogleDriveTransportResponse {
  status: number;
  body?: unknown;
}

export interface GoogleDriveStorageTransport {
  request(
    config: GoogleDriveStorageProviderConfig,
    request: GoogleDriveTransportRequest
  ): Promise<GoogleDriveTransportResponse>;
}

export class FetchGoogleDriveStorageTransport implements GoogleDriveStorageTransport {
  async request(
    config: GoogleDriveStorageProviderConfig,
    request: GoogleDriveTransportRequest
  ): Promise<GoogleDriveTransportResponse> {
    const baseUrl = request.upload ? config.uploadBaseUrl : config.baseUrl;
    const url = new URL(`${baseUrl}${request.path}`);

    for (const [key, value] of Object.entries(request.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${config.credentials}`,
        'Content-Type': 'application/json'
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body)
    });

    const text = await response.text();
    const body = text.length === 0 ? undefined : parseBody(text);

    return {
      status: response.status,
      body
    };
  }
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
