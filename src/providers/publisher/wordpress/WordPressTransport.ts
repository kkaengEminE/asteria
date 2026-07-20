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
  categoryIds?: number[];
  tagIds?: number[];
  featuredMediaId?: number;
}

export interface WordPressTransport {
  createPost(request: WordPressTransportCreatePostRequest): Promise<WordPressTransportPostResponse>;
}

export interface WordPressErrorDetails {
  operation: 'category' | 'tag' | 'post';
  httpStatus?: number;
  wordpressCode?: string;
}

export class WordPressTransportError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details: WordPressErrorDetails;

  constructor(options: {
    code: string;
    message: string;
    retryable: boolean;
    details: WordPressErrorDetails;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'WordPressTransportError';
    this.code = options.code;
    this.retryable = options.retryable;
    this.details = options.details;
  }
}

export class WordPressTransportNotConfiguredError extends Error {
  readonly code = 'wordpress_transport_not_configured';
  readonly retryable = false;

  constructor() {
    super('WordPress transport is not configured. Enable WordPress explicitly before draft execution.');
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
      throw new WordPressTransportError({
        code: 'wordpress_draft_only',
        message: 'WordPress transport accepts draft status only.',
        retryable: false,
        details: { operation: 'post' }
      });
    }

    const baseUrl = request.siteUrl.replace(/\/+$/, '');
    const authorization = `Basic ${Buffer.from(`${request.username}:${request.applicationPassword}`).toString('base64')}`;
    const categoryIds = await this.resolveTerms(baseUrl, authorization, 'categories', request.post.categories ?? []);
    const tagIds = await this.resolveTerms(baseUrl, authorization, 'tags', request.post.tags ?? []);
    const payload = await this.requestJson(
      `${baseUrl}/wp-json/wp/v2/posts`,
      {
        method: 'POST',
        headers: createHeaders(authorization),
        body: JSON.stringify({
          title: request.post.title,
          content: request.post.content,
          excerpt: request.post.excerpt,
          slug: request.post.slug,
          status: 'draft',
          categories: categoryIds,
          tags: tagIds,
          featured_media: request.post.featuredMediaId
        })
      },
      'post'
    );

    if (!isRecord(payload)) {
      throw new WordPressTransportError({
        code: 'wordpress_invalid_response',
        message: 'WordPress draft response had an unsupported shape.',
        retryable: false,
        details: { operation: 'post' }
      });
    }

    if (payload.status !== 'draft') {
      throw new WordPressTransportError({
        code: 'wordpress_status_mismatch',
        message: 'WordPress did not confirm draft status.',
        retryable: false,
        details: { operation: 'post' }
      });
    }

    const id = readPositiveInteger(payload.id);
    if (!id) {
      throw new WordPressTransportError({
        code: 'wordpress_invalid_response',
        message: 'WordPress draft response did not include a valid post ID.',
        retryable: false,
        details: { operation: 'post' }
      });
    }

    return {
      id: String(id),
      link: typeof payload.link === 'string' ? payload.link : undefined,
      status: 'draft',
      categoryIds,
      tagIds,
      featuredMediaId: request.post.featuredMediaId
    };
  }

  private async resolveTerms(
    baseUrl: string,
    authorization: string,
    taxonomy: 'categories' | 'tags',
    names: string[]
  ): Promise<number[]> {
    const ids: number[] = [];

    for (const name of [...new Set(names.map((value) => value.trim()).filter(Boolean))]) {
      const operation = taxonomy === 'categories' ? 'category' : 'tag';
      const found = await this.requestJson(
        `${baseUrl}/wp-json/wp/v2/${taxonomy}?search=${encodeURIComponent(name)}&per_page=100`,
        { headers: createHeaders(authorization) },
        operation
      );
      const existing = Array.isArray(found)
        ? found.find((term) => isRecord(term) && typeof term.name === 'string' && term.name.toLocaleLowerCase() === name.toLocaleLowerCase())
        : undefined;
      const existingId = isRecord(existing) ? readPositiveInteger(existing.id) : undefined;

      if (existingId) {
        ids.push(existingId);
        continue;
      }

      try {
        const created = await this.requestJson(
          `${baseUrl}/wp-json/wp/v2/${taxonomy}`,
          {
            method: 'POST',
            headers: createHeaders(authorization),
            body: JSON.stringify({ name })
          },
          operation
        );
        if (!isRecord(created)) {
          throw new WordPressTransportError({
            code: 'wordpress_invalid_response',
            message: `WordPress ${operation} response had an unsupported shape.`,
            retryable: false,
            details: { operation }
          });
        }
        const createdId = readPositiveInteger(created.id);
        if (!createdId) {
          throw new WordPressTransportError({
            code: 'wordpress_invalid_response',
            message: `WordPress ${operation} response did not include a valid term ID.`,
            retryable: false,
            details: { operation }
          });
        }
        ids.push(createdId);
      } catch (error) {
        const existingTermId = error instanceof WordPressTransportError
          ? readPositiveInteger(error.cause && isRecord(error.cause) ? error.cause.termId : undefined)
          : undefined;
        if (existingTermId) ids.push(existingTermId);
        else throw error;
      }
    }

    return ids;
  }

  private async requestJson(
    url: string,
    init: RequestInit,
    operation: WordPressErrorDetails['operation']
  ): Promise<Record<string, unknown> | unknown[]> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      throw new WordPressTransportError({
        code: 'wordpress_network_error',
        message: `WordPress ${operation} request could not reach the server.`,
        retryable: true,
        details: { operation },
        cause: error
      });
    }

    const payload = await readJsonResponse(response, operation);
    if (!response.ok) {
      const wordpressCode = isRecord(payload) && typeof payload.code === 'string' ? payload.code : undefined;
      const termId = isRecord(payload) && isRecord(payload.data) ? readPositiveInteger(payload.data.term_id) : undefined;
      throw new WordPressTransportError({
        code: wordpressCode ? `wordpress_${wordpressCode}` : 'wordpress_http_error',
        message: `WordPress ${operation} request failed with status ${response.status}.`,
        retryable: isTransientStatus(response.status),
        details: { operation, httpStatus: response.status, wordpressCode },
        cause: termId ? { termId } : undefined
      });
    }

    return payload;
  }
}

function createHeaders(authorization: string): Record<string, string> {
  return { Authorization: authorization, 'Content-Type': 'application/json' };
}

async function readJsonResponse(response: Response, operation: WordPressErrorDetails['operation']): Promise<Record<string, unknown> | unknown[]> {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) || Array.isArray(payload)) return payload;
  } catch (error) {
    throw new WordPressTransportError({
      code: 'wordpress_invalid_json',
      message: `WordPress ${operation} response was not valid JSON.`,
      retryable: isTransientStatus(response.status),
      details: { operation, httpStatus: response.status },
      cause: error
    });
  }
  throw new WordPressTransportError({
    code: 'wordpress_invalid_response',
    message: `WordPress ${operation} response had an unsupported shape.`,
    retryable: false,
    details: { operation, httpStatus: response.status }
  });
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function readPositiveInteger(value: unknown): number | undefined {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number) && number > 0 ? number : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
