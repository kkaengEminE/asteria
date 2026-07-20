import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  executeWordPressDraft,
  processAsteriaApiRequest,
  redactWordPressError,
  validateWordPressDraftApiRequest,
  createWordPressDraftPublishingPackage,
  WordPressDraftExecutionError
} from '../src/api/index.ts';

test('POST /wordpress/drafts validates and passes a narrow draft request to its handler', async () => {
  const calls: unknown[] = [];
  const response = await processAsteriaApiRequest({
    method: 'POST',
    path: '/wordpress/drafts',
    bodyText: JSON.stringify(createDraftRequest()),
    headers: { 'x-client-request-id': 'draft-request-1' }
  }, {
    wordpressDraft: async (request) => {
      calls.push(request);
      return {
        state: 'saved',
        draftId: '71',
        editUrl: 'https://example.test/wp-admin/post.php?post=71&action=edit',
        destinationSite: 'Editorial WordPress',
        savedAt: '2026-07-16T00:00:00.000Z',
        clientRequestId: request.clientRequestId
      };
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal((response.body as Record<string, unknown>).draftId, '71');
});

test('POST /wordpress/drafts rejects malformed input and status override attempts', async () => {
  const malformed = await processAsteriaApiRequest({
    method: 'POST',
    path: '/wordpress/drafts',
    bodyText: JSON.stringify({ article: { title: '' } }),
    headers: { 'x-client-request-id': 'malformed-request' }
  });
  const override = await processAsteriaApiRequest({
    method: 'POST',
    path: '/wordpress/drafts',
    bodyText: JSON.stringify({ ...createDraftRequest(), status: 'publish' }),
    headers: { 'x-client-request-id': 'override-request' }
  });

  assert.equal(malformed.statusCode, 400);
  assert.equal(override.statusCode, 400);
  assert.match(String((override.body as Record<string, unknown>).message), /Unsupported field: status/);
});

test('POST /wordpress/drafts requires one client request ID header per save attempt', async () => {
  const response = await processAsteriaApiRequest({
    method: 'POST',
    path: '/wordpress/drafts',
    bodyText: JSON.stringify(createDraftRequest())
  });

  assert.equal(response.statusCode, 400);
  assert.match(String((response.body as Record<string, unknown>).message), /X-Client-Request-Id/);
});

test('wordpress draft execution is disabled by default', async () => {
  await assert.rejects(
    () => executeWordPressDraft(validateWordPressDraftApiRequest(createDraftRequest(), 'draft-request-1'), {}),
    (error: unknown) => error instanceof WordPressDraftExecutionError && error.code === 'wordpress_draft_disabled'
  );
});

test('wordpress draft execution reports missing credentials without leaking values', async () => {
  await assert.rejects(
    () => executeWordPressDraft(validateWordPressDraftApiRequest(createDraftRequest(), 'draft-request-1'), {
      WORDPRESS_ENABLED: 'true',
      ASTERIA_WORDPRESS_DRAFT_ENABLED: 'true',
      WORDPRESS_BASE_URL: 'https://example.test'
    }),
    (error: unknown) => {
      assert.ok(error instanceof WordPressDraftExecutionError);
      assert.match(error.message, /WORDPRESS_USERNAME, WORDPRESS_APPLICATION_PASSWORD/);
      return true;
    }
  );
});

test('wordpress errors redact credentials authorization and URLs', () => {
  const redacted = redactWordPressError(
    'authorization=Basic dXNlcjpwYXNz password=secret failed at https://user:pass@example.test/wp-json'
  );

  assert.doesNotMatch(redacted, /secret|dXNlcjpwYXNz|user:pass|example\.test/);
  assert.match(redacted, /\[redacted/);
});

test('wordpress draft endpoint exposes no public publishing route', async () => {
  const response = await processAsteriaApiRequest({
    method: 'POST',
    path: '/wordpress/publish',
    bodyText: JSON.stringify(createDraftRequest())
  });

  assert.equal(response.statusCode, 404);
});

test('wordpress draft endpoint returns structured safe execution errors', async () => {
  const response = await processAsteriaApiRequest({
    method: 'POST',
    path: '/wordpress/drafts',
    bodyText: JSON.stringify(createDraftRequest()),
    headers: { 'x-client-request-id': 'draft-request-failure' }
  }, {
    wordpressDraft: async () => {
      throw new WordPressDraftExecutionError(
        'wordpress_rest_cannot_create',
        'WordPress post request failed with status 401.',
        { operation: 'post', httpStatus: 401, wordpressCode: 'rest_cannot_create' }
      );
    }
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, {
    error: 'wordpress_rest_cannot_create',
    message: 'WordPress post request failed with status 401.',
    details: { operation: 'post', httpStatus: 401, wordpressCode: 'rest_cannot_create' }
  });
});

test('wordpress draft request maps magazine keywords and optional featured media', () => {
  const request = validateWordPressDraftApiRequest({
    ...createDraftRequest(),
    featuredImageId: 91
  }, 'draft-request-taxonomy');
  const pkg = createWordPressDraftPublishingPackage(request, new Date('2026-07-20T00:00:00.000Z'));

  assert.equal(pkg.article.metadata.category?.name, 'cat');
  assert.deepEqual(pkg.article.metadata.tags.map((tag) => tag.name), ['editorial']);
  assert.equal(pkg.metadata?.wordpressFeaturedMediaId, 91);
});

test('wordpress draft request rejects invalid featured media IDs', () => {
  assert.throws(
    () => validateWordPressDraftApiRequest({ ...createDraftRequest(), featuredImageId: 0 }, 'draft-request-image'),
    /featuredImageId must be a positive integer/
  );
});

function createDraftRequest() {
  return {
    article: {
      title: 'Edited title',
      body: 'Edited body',
      summary: 'Edited summary',
      slug: 'edited-title',
      language: 'ko-KR'
    },
    seo: {
      metaTitle: 'Edited SEO title',
      metaDescription: 'Edited SEO description',
      keywords: ['editorial']
    },
    faq: [{ question: 'Edited question?', answer: 'Edited answer.' }],
    magazine: 'cat'
  };
}
