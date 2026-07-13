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
