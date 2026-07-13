import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCategory, createPublishingPackage, createTag } from '../src/domain/content/index.ts';
import { MetricsService } from '../src/services/metrics/index.ts';
import { DryRunPublisher, PublisherService } from '../src/services/publisher/index.ts';
import { MockAIProvider } from '../src/providers/ai/index.ts';
import { ContentGenerationWorkflow } from '../src/workflows/index.ts';

test('metrics service increments counters', () => {
  const metrics = new MetricsService({
    now: () => '2026-07-10T00:00:00.000Z'
  });

  metrics.incrementCounter('content_generation.started');
  metrics.incrementCounter('content_generation.started', 2);

  const snapshot = metrics.snapshot('2026-07-10T00:00:01.000Z');

  assert.equal(snapshot.counters.find((counter) => counter.name === 'content_generation.started')?.value, 3);
  assert.equal(snapshot.events.length, 2);
});

test('metrics service records durations', () => {
  const metrics = new MetricsService();

  metrics.recordDuration('content_generation.duration_ms', 100);
  metrics.recordDuration('content_generation.duration_ms', 300);

  const duration = metrics.snapshot().durations.find((entry) => entry.name === 'content_generation.duration_ms');

  assert.equal(duration?.count, 2);
  assert.equal(duration?.totalMs, 400);
  assert.equal(duration?.averageMs, 200);
  assert.equal(duration?.minMs, 100);
  assert.equal(duration?.maxMs, 300);
});

test('metrics service snapshot includes failure summaries', () => {
  const metrics = new MetricsService();

  metrics.recordFailure('publisher.failed', 'Temporary publisher failure.');
  metrics.recordFailure('publisher.failed', 'Second publisher failure.');

  const failure = metrics.snapshot().failures.find((entry) => entry.name === 'publisher.failed');

  assert.equal(failure?.count, 2);
  assert.equal(failure?.lastFailureReason, 'Second publisher failure.');
});

test('content generation workflow records metrics', async () => {
  const metrics = new MetricsService();
  const workflow = new ContentGenerationWorkflow({
    aiProvider: new MockAIProvider(),
    metricsService: metrics
  });

  await workflow.execute({
    topic: '고양이가 밤에 뛰어다니는 이유',
    language: 'ko-KR',
    audience: 'cat guardians',
    tone: 'practical',
    magazineName: 'Cat Magazine'
  });

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.counters.find((counter) => counter.name === 'content_generation.started')?.value, 1);
  assert.equal(snapshot.counters.find((counter) => counter.name === 'content_generation.succeeded')?.value, 1);
  assert.equal(snapshot.durations.some((duration) => duration.name === 'content_generation.duration_ms'), true);
});

test('publisher service records metrics', async () => {
  const metrics = new MetricsService();
  const service = new PublisherService({
    metricsService: metrics,
    publisher: new DryRunPublisher(),
    publishingEnabled: false
  });

  await service.publish({
    publishingPackage: createPackageFixture(),
    destination: {
      type: 'wordpress',
      name: 'Cat Magazine WordPress',
      enabled: true,
      dryRunOnly: true
    },
    mode: 'preview',
    metadata: {
      dryRun: true
    }
  });

  const snapshot = metrics.snapshot();

  assert.equal(snapshot.counters.find((counter) => counter.name === 'publisher.started')?.value, 1);
  assert.equal(snapshot.counters.find((counter) => counter.name === 'publisher.succeeded')?.value, 1);
  assert.equal(snapshot.durations.some((duration) => duration.name === 'publisher.duration_ms'), true);
});

function createPackageFixture() {
  return createPublishingPackage({
    article: {
      title: 'Publisher Metrics Article',
      subtitle: 'Dry-run metrics',
      summary: 'A dry-run article summary for publisher metrics.',
      body: 'This article verifies publisher metrics without network calls.',
      slug: 'publisher-metrics-article',
      language: 'en-US',
      author: 'Asteria',
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
      metadata: {
        status: 'draft',
        tags: [createTag('cat')],
        category: createCategory('cat-care')
      }
    },
    summary: {
      text: 'Publisher metrics summary.'
    },
    seo: {
      metaTitle: 'Publisher Metrics Article',
      metaDescription: 'Publisher metrics dry-run preview.',
      keywords: ['cat', 'metrics']
    },
    faq: [
      {
        question: 'Does this publish content?',
        answer: 'No. It only records dry-run metrics.'
      }
    ],
    imagePrompt: {
      prompt: 'Cat beside analytics dashboard.'
    },
    productPrompt: {
      prompt: 'Cat enrichment products.'
    },
    metadata: {
      dryRun: true
    }
  });
}
