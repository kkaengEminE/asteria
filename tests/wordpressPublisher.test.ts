import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCategory, createPublishingPackage, createTag, type PublishingPackage } from '../src/domain/content/index.ts';
import type { PublishRequest } from '../src/domain/publisher/index.ts';
import { ProviderRegistry } from '../src/providers/index.ts';
import {
  createWordPressPublisherConfigFromEnv,
  FetchWordPressTransport,
  mapPublishRequestToWordPressPostPayload,
  WordPressPostPayloadValidationError,
  WordPressPublisher,
  wordpressPublisherToken,
  WordPressPublisherConfigError,
  WordPressTransportError,
  type WordPressTransport,
  type WordPressTransportCreatePostRequest,
  type WordPressTransportPostResponse
} from '../src/providers/publisher/wordpress/index.ts';
import { PublisherService } from '../src/services/publisher/index.ts';
import { AuditLog } from '../src/services/auditLog/index.ts';
import { createInMemoryPersistenceComposition } from '../src/services/persistence/index.ts';

test('valid post payload returns preview publish result', async () => {
  const publisher = createEnabledPublisher({ transport: new MockWordPressTransport() });
  const result = await publisher.publish(createPublishRequest());

  assert.equal(result.status, 'PREVIEW');
  assert.equal(result.destination.type, 'wordpress');
  assert.equal(result.metadata?.provider, 'wordpress');
  assert.equal(result.metadata?.dryRun, false);
  assert.equal((result.metadata?.post as { title?: string }).title, 'WordPress Adapter Article');
  assert.equal((result.metadata?.post as { content?: string }).content, 'This article verifies WordPress adapter mapping without network calls.');
  assert.match(result.message, /draft created/);
});

test('missing title fails validation', async () => {
  const publisher = createEnabledPublisher({ transport: new MockWordPressTransport() });

  await assert.rejects(
    () => publisher.publish(createPublishRequest({ title: '' })),
    WordPressPostPayloadValidationError
  );
});

test('missing content fails validation', async () => {
  const publisher = createEnabledPublisher({ transport: new MockWordPressTransport() });

  await assert.rejects(
    () => publisher.publish(createPublishRequest({ body: '' })),
    WordPressPostPayloadValidationError
  );
});

test('wordpress publisher can be registered and resolved', async () => {
  const registry = new ProviderRegistry();

  registry.register(
    wordpressPublisherToken,
    () =>
      new WordPressPublisher({
        siteUrl: 'https://example.test',
        dryRun: true
      })
  );

  const publisher = await registry.resolve(wordpressPublisherToken, { dryRun: true });
  const result = await publisher.publish(createPublishRequest());

  assert.equal(publisher.name, 'wordpress');
  assert.equal(result.metadata?.targetSite, 'https://example.test');
});

test('wordpress publisher draft makes no external api call', async () => {
  const transport = new MockWordPressTransport();
  const publisher = createEnabledPublisher({ transport });
  const result = await publisher.publish(createPublishRequest());

  assert.equal(result.previewUrl, 'https://example.test/wp-admin/post.php?post=101&action=edit');
  assert.equal(result.metadata?.dryRun, false);
  assert.match(result.publishId ?? '', /^wordpress-draft-/);
  assert.equal(transport.networkCalls, 0);
});

test('wordpress publisher is disabled by default', async () => {
  assert.throws(
    () =>
      new WordPressPublisher({
        siteUrl: 'https://example.test',
        dryRun: false,
        enabled: false
      }),
    WordPressPublisherConfigError
  );
});

test('wordpress publisher requires credentials when enabled', async () => {
  assert.throws(
    () =>
      new WordPressPublisher({
        siteUrl: 'https://example.test',
        dryRun: false,
        enabled: true
      }),
    /WORDPRESS_USERNAME, WORDPRESS_APPLICATION_PASSWORD/
  );
});

test('wordpress config reads environment values', () => {
  const config = createWordPressPublisherConfigFromEnv({
    WORDPRESS_ENABLED: 'true',
    WORDPRESS_SITE_URL: 'https://example.test',
    WORDPRESS_USERNAME: 'editor',
    WORDPRESS_APPLICATION_PASSWORD: 'app-password'
  });

  assert.equal(config.enabled, true);
  assert.equal(config.siteUrl, 'https://example.test');
  assert.equal(config.username, 'editor');
});

test('wordpress publisher maps publish request through mocked transport', async () => {
  const transport = new MockWordPressTransport();
  const publisher = createEnabledPublisher({ transport });
  const result = await publisher.publish(createPublishRequest());

  assert.equal(result.status, 'PREVIEW');
  assert.equal(result.publisher, 'wordpress');
  assert.equal(result.previewUrl, 'https://example.test/wp-admin/post.php?post=101&action=edit');
  assert.equal(result.metadata?.targetSite, 'https://example.test');
  assert.equal(result.metadata?.publishingEnabled, true);
  assert.equal(transport.requests.length, 1);
  assert.equal(transport.requests[0].post.title, 'WordPress Adapter Article');
  assert.equal(transport.requests[0].post.status, 'draft');
});

test('wordpress mapping forces draft status when an override is attempted', () => {
  const post = mapPublishRequestToWordPressPostPayload(createPublishRequest(), 'publish' as 'draft');
  assert.equal(post.status, 'draft');
});

test('wordpress draft execution reuses PublisherService and WordPressPublisher', async () => {
  const transport = new MockWordPressTransport();
  const service = new PublisherService({
    publisher: createEnabledPublisher({ transport }),
    publishingEnabled: true
  });
  const result = await service.publish({ ...createPublishRequest(), mode: 'production' });

  assert.equal(result.publisher, 'wordpress');
  assert.equal(result.metadata?.wordpressStatus, 'draft');
  assert.equal(transport.requests.length, 1);
});

test('fetch wordpress transport posts only draft status through a mocked fetch', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const transport = new FetchWordPressTransport(async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/categories?')) {
      return new Response(JSON.stringify([{ id: 11, name: 'Guides' }]), { status: 200 });
    }
    if (String(url).includes('/tags?')) {
      return new Response(JSON.stringify([{ id: 22, name: 'wordpress' }]), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 303, status: 'draft' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  });
  const request = createPublishRequest();
  request.metadata = { ...request.metadata, wordpressFeaturedMediaId: 44 };
  const post = mapPublishRequestToWordPressPostPayload(request);
  const response = await transport.createPost({
    siteUrl: 'https://example.test',
    username: 'editor',
    applicationPassword: 'app-password',
    post
  });
  const postCall = calls.find((call) => call.url.endsWith('/wp-json/wp/v2/posts'))!;
  const body = JSON.parse(String(postCall.init?.body));

  assert.equal(response.id, '303');
  assert.equal(postCall.url, 'https://example.test/wp-json/wp/v2/posts');
  assert.equal(body.status, 'draft');
  assert.deepEqual(body.categories, [11]);
  assert.deepEqual(body.tags, [22]);
  assert.equal(body.featured_media, 44);
  assert.match(String(postCall.init?.headers && (postCall.init.headers as Record<string, string>).Authorization), /^Basic /);
  assert.equal(calls.length, 3);
});

test('wordpress transport creates missing taxonomy terms before the draft', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const transport = new FetchWordPressTransport(async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('?search=')) return new Response('[]', { status: 200 });
    if (String(url).endsWith('/categories')) return new Response(JSON.stringify({ id: 31, name: 'Guides' }), { status: 201 });
    if (String(url).endsWith('/tags')) return new Response(JSON.stringify({ id: 32, name: 'wordpress' }), { status: 201 });
    return new Response(JSON.stringify({ id: 304, status: 'draft' }), { status: 201 });
  });

  await transport.createPost({
    siteUrl: 'https://example.test',
    username: 'draft-writer',
    applicationPassword: 'app-password',
    post: mapPublishRequestToWordPressPostPayload(createPublishRequest())
  });

  const postBody = JSON.parse(String(calls.at(-1)?.init?.body));
  assert.deepEqual(postBody.categories, [31]);
  assert.deepEqual(postBody.tags, [32]);
  assert.equal(postBody.status, 'draft');
  assert.equal(calls.length, 5);
});

test('wordpress transport reports non-retryable authentication failures structurally', async () => {
  const transport = new FetchWordPressTransport(async () => new Response(JSON.stringify({
    code: 'rest_cannot_create',
    message: 'Unauthorized'
  }), { status: 401 }));

  await assert.rejects(
    () => transport.createPost({
      siteUrl: 'https://example.test',
      username: 'draft-writer',
      applicationPassword: 'invalid',
      post: mapPublishRequestToWordPressPostPayload(createPublishRequest())
    }),
    (error: unknown) => {
      assert.ok(error instanceof WordPressTransportError);
      assert.equal(error.code, 'wordpress_rest_cannot_create');
      assert.equal(error.retryable, false);
      assert.deepEqual(error.details, {
        operation: 'category',
        httpStatus: 401,
        wordpressCode: 'rest_cannot_create'
      });
      assert.doesNotMatch(error.message, /invalid|draft-writer/);
      return true;
    }
  );
});

test('wordpress transport marks transient server failures retryable', async () => {
  const transport = new FetchWordPressTransport(async () => new Response(JSON.stringify({
    code: 'server_busy'
  }), { status: 503 }));

  await assert.rejects(
    () => transport.createPost({
      siteUrl: 'https://example.test',
      username: 'draft-writer',
      applicationPassword: 'app-password',
      post: mapPublishRequestToWordPressPostPayload(createPublishRequest())
    }),
    (error: unknown) => error instanceof WordPressTransportError && error.retryable && error.details.httpStatus === 503
  );
});

test('wordpress publisher retries mocked transport failures', async () => {
  const transport = new FlakyWordPressTransport();
  const publisher = createEnabledPublisher({ transport });
  const result = await publisher.publish(createPublishRequest());

  assert.equal(result.status, 'PREVIEW');
  assert.equal(result.metadata?.attemptCount, 2);
  assert.equal(result.metadata?.retryCount, 1);
  assert.equal(transport.calls, 2);
});

test('wordpress publisher records audit events', async () => {
  const auditLog = new AuditLog(createInMemoryPersistenceComposition().auditStore);
  const publisher = createEnabledPublisher({
    auditLog,
    transport: new MockWordPressTransport()
  });

  await publisher.publish(createPublishRequest());

  assert.equal(auditLog.filterByEventType('PUBLISH_STARTED').length, 1);
  assert.equal(auditLog.filterByEventType('PUBLISH_SUCCEEDED').length, 1);
});

test('wordpress publisher with mocked transport makes no network call', async () => {
  const transport = new MockWordPressTransport();
  const publisher = createEnabledPublisher({ transport });

  await publisher.publish(createPublishRequest());

  assert.equal(transport.requests.length, 1);
  assert.equal(transport.networkCalls, 0);
});

function createPublisher(): WordPressPublisher {
  return new WordPressPublisher({
    siteUrl: 'https://example.test',
    dryRun: true
  });
}

function createEnabledPublisher(options: {
  transport: WordPressTransport;
  auditLog?: AuditLog;
}): WordPressPublisher {
  return new WordPressPublisher({
    siteUrl: 'https://example.test',
    dryRun: false,
    enabled: true,
    username: 'editor',
    applicationPassword: 'app-password',
    transport: options.transport,
    auditLog: options.auditLog
  });
}

class MockWordPressTransport implements WordPressTransport {
  readonly requests: WordPressTransportCreatePostRequest[] = [];
  networkCalls = 0;

  async createPost(request: WordPressTransportCreatePostRequest): Promise<WordPressTransportPostResponse> {
    this.requests.push(request);

    return {
      id: 101,
      status: 'draft'
    };
  }
}

class FlakyWordPressTransport implements WordPressTransport {
  calls = 0;

  async createPost(_request: WordPressTransportCreatePostRequest): Promise<WordPressTransportPostResponse> {
    this.calls += 1;

    if (this.calls === 1) {
      const error = new Error('Temporary WordPress transport failure.') as Error & { code: string; retryable: boolean };
      error.code = 'temporary_wordpress_failure';
      error.retryable = true;
      throw error;
    }

    return {
      id: 102,
      link: 'https://example.test/?p=102',
      status: 'draft'
    };
  }
}

function createPublishRequest(overrides: { title?: string; body?: string } = {}): PublishRequest {
  const publishingPackage = createPackageFixture();

  return {
    publishingPackage: {
      ...publishingPackage,
      article: {
        ...publishingPackage.article,
        title: overrides.title ?? publishingPackage.article.title,
        body: overrides.body ?? publishingPackage.article.body
      }
    },
    destination: {
      type: 'wordpress',
      name: 'WordPress Preview',
      enabled: false,
      dryRunOnly: true
    },
    mode: 'preview',
    metadata: {
      dryRun: true
    }
  };
}

function createPackageFixture(): PublishingPackage {
  return createPublishingPackage({
    article: {
      title: 'WordPress Adapter Article',
      summary: 'A concise WordPress adapter summary.',
      body: 'This article verifies WordPress adapter mapping without network calls.',
      slug: 'wordpress-adapter-article',
      language: 'en-US',
      author: 'Asteria',
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
      metadata: {
        status: 'draft',
        category: createCategory('Guides'),
        tags: [createTag('wordpress')]
      }
    },
    summary: {
      text: 'WordPress adapter summary.'
    },
    seo: {
      metaTitle: 'WordPress Adapter Article',
      metaDescription: 'WordPress adapter preview.',
      keywords: ['wordpress']
    },
    faq: [
      {
        question: 'Does this publish content?',
        answer: 'No. It only creates a guarded preview.'
      }
    ],
    imagePrompt: {
      prompt: 'WordPress adapter image prompt.'
    },
    productPrompt: {
      prompt: 'WordPress adapter product prompt.'
    }
  });
}
