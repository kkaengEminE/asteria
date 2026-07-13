import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublishingPackage, createTag, type PublishingPackage } from '../src/domain/content/index.ts';
import type { PublishRequest } from '../src/domain/publisher/index.ts';
import { ProviderRegistry } from '../src/providers/index.ts';
import {
  createWordPressPublisherConfigFromEnv,
  WordPressPostPayloadValidationError,
  WordPressPublisher,
  wordpressPublisherToken,
  WordPressPublisherConfigError,
  type WordPressTransport,
  type WordPressTransportCreatePostRequest,
  type WordPressTransportPostResponse
} from '../src/providers/publisher/wordpress/index.ts';
import { AuditLog } from '../src/services/auditLog/index.ts';

test('valid post payload returns preview publish result', async () => {
  const publisher = createEnabledPublisher({ transport: new MockWordPressTransport() });
  const result = await publisher.publish(createPublishRequest());

  assert.equal(result.status, 'PREVIEW');
  assert.equal(result.destination.type, 'wordpress');
  assert.equal(result.metadata?.provider, 'wordpress');
  assert.equal(result.metadata?.dryRun, true);
  assert.equal((result.metadata?.post as { title?: string }).title, 'WordPress Adapter Article');
  assert.equal((result.metadata?.post as { content?: string }).content, 'This article verifies WordPress adapter mapping without network calls.');
  assert.match(result.message, /Publishing remains disabled/);
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

  assert.equal(result.previewUrl, 'https://example.test/?p=101');
  assert.equal(result.metadata?.dryRun, true);
  assert.match(result.publishId ?? '', /^wordpress-preview-/);
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
  assert.equal(result.previewUrl, 'https://example.test/?p=101');
  assert.equal(result.metadata?.targetSite, 'https://example.test');
  assert.equal(result.metadata?.publishingEnabled, true);
  assert.equal(transport.requests.length, 1);
  assert.equal(transport.requests[0].post.title, 'WordPress Adapter Article');
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
  const auditLog = new AuditLog();
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
