import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublishingPayload } from '../src/core/types.ts';
import { ProviderRegistry } from '../src/providers/index.ts';
import {
  WordPressPostPayloadValidationError,
  WordPressPublisher,
  wordpressPublisherToken
} from '../src/providers/publisher/wordpress/index.ts';
import type { WordPressPublishResult } from '../src/providers/publisher/wordpress/index.ts';

test('valid post payload returns preview publish result', async () => {
  const publisher = createPublisher();
  const result = (await publisher.publish(createPayload())) as WordPressPublishResult;

  assert.equal(result.status, 'draft');
  assert.equal(result.destination.type, 'wordpress');
  assert.equal(result.metadata.provider, 'wordpress');
  assert.equal(result.metadata.dryRun, true);
  assert.equal(result.metadata.post.title, 'Mock Cat Care Article');
  assert.equal(result.metadata.post.content, 'Mock content.');
  assert.match(result.message ?? '', /Nothing was published/);
});

test('missing title fails validation', async () => {
  const publisher = createPublisher();
  const payload = createPayload({
    draft: {
      ...createPayload().draft,
      title: ''
    }
  });

  await assert.rejects(() => publisher.publish(payload), WordPressPostPayloadValidationError);
});

test('missing content fails validation', async () => {
  const publisher = createPublisher();
  const payload = createPayload({
    draft: {
      ...createPayload().draft,
      body: ''
    }
  });

  await assert.rejects(() => publisher.publish(payload), WordPressPostPayloadValidationError);
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
  const result = (await publisher.publish(createPayload())) as WordPressPublishResult;

  assert.equal(publisher.name, 'wordpress');
  assert.equal(result.metadata.siteUrl, 'https://example.test');
});

test('wordpress publisher draft makes no external api call', async () => {
  const publisher = createPublisher();
  const result = await publisher.publish(createPayload());

  assert.equal(result.url, undefined);
  assert.equal(result.metadata.dryRun, true);
  assert.match(result.externalId ?? '', /^wordpress-preview-/);
});

function createPublisher(): WordPressPublisher {
  return new WordPressPublisher({
    siteUrl: 'https://example.test',
    dryRun: true
  });
}

function createPayload(overrides: Partial<PublishingPayload> = {}): PublishingPayload {
  return {
    draft: {
      title: 'Mock Cat Care Article',
      slug: 'mock-cat-care-article',
      summary: 'Mock summary.',
      body: 'Mock content.',
      format: 'article',
      language: 'en-US',
      tags: ['cat']
    },
    destination: {
      type: 'wordpress',
      name: 'WordPress Preview',
      enabled: false,
      dryRunOnly: true
    },
    ...overrides
  };
}
