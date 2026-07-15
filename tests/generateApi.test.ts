import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAsteriaApiServer, processAsteriaApiRequest } from '../src/api/index.ts';
import type { DryRunResult } from '../src/magazines/runtime/index.ts';

test('POST /generate calls existing generation runtime and returns JSON result', async () => {
  const response = await processAsteriaApiRequest({
    method: 'POST',
    path: '/generate',
    bodyText: JSON.stringify({
      topic: 'indoor enrichment',
      magazine: 'cat',
      language: 'ko-KR',
      provider: 'mock'
    })
  });
  const body = response.body as Record<string, any>;

  assert.equal(response.statusCode, 200);
  assert.equal(body.topic, 'indoor enrichment');
  assert.equal(body.workflowStatus, 'success');
  assert.equal(body.magazine.slug, 'cat');
  assert.equal(body.contentGenerationMetadata.language, 'ko-KR');
  assert.ok(body.publishingPackage);
});

test('POST /generate passes request values to injected generation handler', async () => {
  const calls: unknown[] = [];
  const response = await processAsteriaApiRequest({
    method: 'POST',
    path: '/generate',
    bodyText: JSON.stringify({
      topic: '강아지가 산책 중 냄새를 오래 맡는 이유',
      magazine: 'dog',
      language: 'ko-KR',
      provider: 'gemini'
    })
  }, {
    generate: async (request) => {
      calls.push(request);
      return createApiResultFixture(request.topic);
    }
  });
  const body = response.body as Record<string, any>;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [{
    topic: '강아지가 산책 중 냄새를 오래 맡는 이유',
    magazine: 'dog',
    language: 'ko-KR',
    provider: 'gemini'
  }]);
  assert.equal(body.topic, '강아지가 산책 중 냄새를 오래 맡는 이유');
});

test('POST /generate accepts openai provider selection', async () => {
  const calls: unknown[] = [];
  const response = await processAsteriaApiRequest({
    method: 'POST',
    path: '/generate',
    bodyText: JSON.stringify({
      topic: 'indoor enrichment',
      provider: 'openai'
    })
  }, {
    generate: async (request) => {
      calls.push(request);
      return createApiResultFixture(request.topic);
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [{
    topic: 'indoor enrichment',
    magazine: undefined,
    language: undefined,
    provider: 'openai'
  }]);
});

test('POST /generate rejects unsupported provider selection', async () => {
  const response = await processAsteriaApiRequest({
    method: 'POST',
    path: '/generate',
    bodyText: JSON.stringify({
      topic: 'indoor enrichment',
      provider: 'unknown'
    })
  }, {
    generate: async () => createApiResultFixture('unused')
  });
  const body = response.body as Record<string, any>;

  assert.equal(response.statusCode, 400);
  assert.equal(body.error, 'invalid_request');
  assert.match(body.message, /provider must be one of/);
});

test('POST /generate returns clean error when selected provider is unavailable', async () => {
  const response = await processAsteriaApiRequest({
    method: 'POST',
    path: '/generate',
    bodyText: JSON.stringify({
      topic: 'indoor enrichment',
      provider: 'gemini'
    })
  }, {
    generate: async () => {
      throw new Error('Gemini production mode is disabled. Set GEMINI_PRODUCTION_ENABLED=true.');
    }
  });
  const body = response.body as Record<string, any>;

  assert.equal(response.statusCode, 500);
  assert.equal(body.error, 'internal_error');
  assert.match(body.message, /GEMINI_PRODUCTION_ENABLED=true/);
});

test('POST /generate rejects missing topic', async () => {
  const response = await processAsteriaApiRequest({
    method: 'POST',
    path: '/generate',
    bodyText: JSON.stringify({
      magazine: 'cat',
      language: 'ko-KR'
    })
  }, {
    generate: async () => createApiResultFixture('unused')
  });
  const body = response.body as Record<string, any>;

  assert.equal(response.statusCode, 400);
  assert.equal(body.error, 'invalid_request');
  assert.match(body.message, /topic is required/);
});

test('generate api rejects unsupported routes and methods', async () => {
  const notFound = await processAsteriaApiRequest({
    method: 'POST',
    path: '/missing',
    bodyText: JSON.stringify({
      topic: 'indoor enrichment'
    })
  });
  const method = await processAsteriaApiRequest({
    method: 'GET',
    path: '/generate',
    bodyText: ''
  });

  assert.equal(notFound.statusCode, 404);
  assert.equal(method.statusCode, 405);
  assert.equal(method.headers.Allow, 'POST');
});

test('createAsteriaApiServer returns an HTTP server without starting it', () => {
  const server = createAsteriaApiServer();

  assert.equal(server.listening, false);
});

test('web app assets are served from the API server', async () => {
  const server = createAsteriaApiServer();
  const response = await invokeServer(server, {
    method: 'GET',
    url: '/',
    body: ''
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /<h1 id="app-title">Asteria<\/h1>/);
  assert.match(String(response.headers['content-type']), /text\/html/);
});

function createApiResultFixture(topic: string): DryRunResult {
  return {
    topic,
    workflowStatus: 'success',
    executedSteps: ['Generate Publishing Package'],
    previewReport: {
      content: {},
      media: {},
      monetization: {},
      channels: [],
      publishing: {},
      observability: {}
    }
  };
}

function invokeServer(
  server: ReturnType<typeof createAsteriaApiServer>,
  request: { method: string; url: string; body: string }
): Promise<{ statusCode: number; headers: Record<string, string | number | string[]>; body: string }> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    const response = {
      statusCode: 0,
      headers: {} as Record<string, string | number | string[]>,
      setHeader(name: string, value: string | number | readonly string[]) {
        this.headers[name.toLowerCase()] = Array.isArray(value) ? value : String(value);
      },
      end(body: string) {
        chunks.push(body);
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: chunks.join('')
        });
      }
    };
    const incoming = {
      method: request.method,
      url: request.url,
      async *[Symbol.asyncIterator]() {
        if (request.body.length > 0) {
          yield Buffer.from(request.body);
        }
      }
    };

    server.emit('request', incoming, response);
  });
}
