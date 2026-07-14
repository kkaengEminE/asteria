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
      language: 'ko-KR'
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
      language: 'ko-KR'
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
    language: 'ko-KR'
  }]);
  assert.equal(body.topic, '강아지가 산책 중 냄새를 오래 맡는 이유');
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
