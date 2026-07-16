import type { WordPressPostPayload } from './WordPressPostPayload.ts';

export interface WordPressTransportCreatePostRequest {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  post: WordPressPostPayload;
}

export interface WordPressTransportPostResponse {
  id: string | number;
  link?: string;
  status?: string;
}

export interface WordPressTransport {
  createPost(request: WordPressTransportCreatePostRequest): Promise<WordPressTransportPostResponse>;
}

export class WordPressTransportNotConfiguredError extends Error {
  constructor() {
    super('WordPress transport is not configured. Inject a mocked transport for tests or a real transport in a future production sprint.');
    this.name = 'WordPressTransportNotConfiguredError';
  }
}

export class WordPressDisabledTransport implements WordPressTransport {
  async createPost(): Promise<WordPressTransportPostResponse> {
    throw new WordPressTransportNotConfiguredError();
  }
}

export class FetchWordPressTransport implements WordPressTransport {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
  }

  async createPost(request: WordPressTransportCreatePostRequest): Promise<WordPressTransportPostResponse> {
    if (request.post.status !== 'draft') {
      throw new Error('WordPress transport accepts draft status only.');
    }

    const endpoint = `${request.siteUrl.replace(/\/+$/, '')}/wp-json/wp/v2/posts`;
    const authorization = Buffer.from(`${request.username}:${request.applicationPassword}`).toString('base64');
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authorization}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: request.post.title,
        content: request.post.content,
        excerpt: request.post.excerpt,
        slug: request.post.slug,
        status: 'draft'
      })
    });
    const payload = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const error = new Error(`WordPress draft request failed with status ${response.status}.`) as Error & { code: string };
      error.code = 'wordpress_http_error';
      throw error;
    }

    if (payload.status !== 'draft') {
      throw new Error('WordPress did not confirm draft status.');
    }

    return {
      id: String(payload.id ?? ''),
      link: typeof payload.link === 'string' ? payload.link : undefined,
      status: typeof payload.status === 'string' ? payload.status : undefined
    };
  }
}
