import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDryRunReport, parseDryRunArgs } from '../scripts/dry-run.ts';

test('dry-run parser supports ai mode and language option', () => {
  const parsed = parseDryRunArgs(['--magazine', 'cat', '--ai', 'gemini', '--language', 'ko-KR', '고양이가 밤에 뛰어다니는 이유']);

  assert.equal(parsed.magazine, 'cat');
  assert.equal(parsed.aiMode, 'gemini');
  assert.equal(parsed.language, 'ko-KR');
  assert.equal(parsed.topic, '고양이가 밤에 뛰어다니는 이유');
});

test('dry-run parser supports dog magazine mode', () => {
  const parsed = parseDryRunArgs(['--magazine=dog', '--language=ko-KR', '강아지가 산책 중 냄새를 오래 맡는 이유']);

  assert.equal(parsed.magazine, 'dog');
  assert.equal(parsed.language, 'ko-KR');
  assert.equal(parsed.topic, '강아지가 산책 중 냄새를 오래 맡는 이유');
});

test('dry-run report uses mock article label only for mock provider', () => {
  const report = formatDryRunReport(createDryRunResultFixture('mock-ai'));

  assert.match(report, /Generated Mock Article:/);
});

test('dry-run report uses generated article label for real providers', () => {
  const report = formatDryRunReport(createDryRunResultFixture('gemini'));

  assert.match(report, /Generated Article:/);
  assert.doesNotMatch(report, /Generated Mock Article:/);
});

test('gemini ko-KR dry-run report uses publishing package article as source of truth', () => {
  const report = formatDryRunReport(createDryRunResultFixture('gemini', {
    articlePreview: 'Title: Legacy English Article\nBody: This conflicting legacy preview should not show.',
    publishingPackage: createKoreanPublishingPackageFixture()
  }));

  assert.match(report, /Generated Article:\nTitle: 고양이가 밤에 뛰어다니는 이유/);
  assert.match(report, /Body:\n# 고양이가 밤에 뛰어다니는 이유/);
  assert.doesNotMatch(report, /Legacy English Article/);
  assert.doesNotMatch(report, /conflicting legacy preview/);
});

test('dry-run report uses publishing package seo metadata as source of truth', () => {
  const report = formatDryRunReport(createDryRunResultFixture('gemini', {
    seoPreview: 'Title Tag: Legacy English SEO',
    publishingPackage: createKoreanPublishingPackageFixture()
  }));

  assert.match(report, /SEO Preview:\nTitle Tag: 고양이가 밤에 뛰어다니는 이유/);
  assert.match(report, /Meta Description: 고양이가 밤에 뛰어다니는 이유와 완화 방법/);
  assert.match(report, /Keywords: 고양이, 우다다/);
  assert.doesNotMatch(report, /Legacy English SEO/);
});

test('dry-run report displays retry metadata when available', () => {
  const report = formatDryRunReport(createDryRunResultFixture('mock-ai', {
    retryMetadata: {
      status: 'success',
      attemptCount: 2,
      retryCount: 1,
      policy: {
        maxAttempts: 2,
        delayMs: 25
      },
      attempts: [
        {
          attemptNumber: 1,
          status: 'failed',
          reason: {
            code: 'dry_run_probe'
          }
        },
        {
          attemptNumber: 2,
          status: 'success'
        }
      ]
    }
  }));

  assert.match(report, /Retry Metadata:/);
  assert.match(report, /Status: success/);
  assert.match(report, /History: #1:failed:dry_run_probe -> #2:success/);
});

test('dry-run report displays scheduler information when available', () => {
  const report = formatDryRunReport(createDryRunResultFixture('mock-ai', {
    schedulerResult: {
      status: 'scheduled',
      job: {
        id: 'schedule-1',
        queueItemId: 'queue-1',
        status: 'SCHEDULED',
        policy: {
          scheduledFor: '2026-07-10T09:00:00.000Z'
        },
        scheduledFor: '2026-07-10T09:00:00.000Z',
        createdAt: '2026-07-10T00:00:00.000Z',
        updatedAt: '2026-07-10T00:00:00.000Z'
      },
      message: 'Queue item queue-1 scheduled for 2026-07-10T09:00:00.000Z.'
    }
  }));

  assert.match(report, /Scheduler:/);
  assert.match(report, /Result: scheduled/);
  assert.match(report, /Job ID: schedule-1/);
});

test('dry-run report displays execution preview information when available', () => {
  const report = formatDryRunReport(createDryRunResultFixture('mock-ai', {
    executionResult: {
      status: 'SUCCEEDED',
      due: true,
      attemptCount: 1,
      retryCount: 0,
      job: {
        id: 'schedule-1'
      },
      queueResult: {
        item: {
          status: 'PROCESSING'
        }
      },
      message: 'Scheduled job schedule-1 execution preview succeeded. Publishing remains disabled.'
    }
  }));

  assert.match(report, /Execution Preview:/);
  assert.match(report, /Scheduled Job ID: schedule-1/);
  assert.match(report, /Execution Status: SUCCEEDED/);
  assert.match(report, /Queue Status: PROCESSING/);
});

function createDryRunResultFixture(providerName: string, overrides: Record<string, unknown> = {}): any {
  return {
    magazine: {
      name: 'Cat Magazine'
    },
    topic: 'topic',
    workflowStatus: 'success',
    executedSteps: [],
    renderedPromptPreview: 'prompt',
    articlePreview: 'article preview',
    seoPreview: 'seo preview',
    contentGenerationMetadata: {
      providerName
    },
    ...overrides
  };
}

function createKoreanPublishingPackageFixture(): any {
  return {
    article: {
      title: '고양이가 밤에 뛰어다니는 이유',
      subtitle: '야간 활동 이해하기',
      summary: '고양이의 야간 활동 원인을 설명합니다.',
      body: '# 고양이가 밤에 뛰어다니는 이유\n고양이는 새벽과 밤에 활동성이 높아질 수 있습니다.\n\n1. 사냥 본능이 남아 있습니다.\n2. 낮 동안 에너지가 충분히 소모되지 않았을 수 있습니다.',
      language: 'ko-KR'
    },
    summary: {
      text: '고양이 야간 활동 요약'
    },
    seo: {
      metaTitle: '고양이가 밤에 뛰어다니는 이유',
      metaDescription: '고양이가 밤에 뛰어다니는 이유와 완화 방법',
      keywords: ['고양이', '우다다']
    },
    faq: [
      {
        question: '밤에 뛰는 행동은 정상인가요?'
      }
    ],
    imagePrompt: {
      prompt: '밤에 노는 고양이'
    },
    productPrompt: {
      prompt: '고양이 장난감'
    }
  };
}
