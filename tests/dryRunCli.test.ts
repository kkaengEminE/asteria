import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDryRunReport, parseDryRunArgs } from '../scripts/dry-run.ts';

test('dry-run parser supports ai mode and language option', () => {
  const parsed = parseDryRunArgs(['--ai', 'gemini', '--language', 'ko-KR', '고양이가 밤에 뛰어다니는 이유']);

  assert.equal(parsed.aiMode, 'gemini');
  assert.equal(parsed.language, 'ko-KR');
  assert.equal(parsed.topic, '고양이가 밤에 뛰어다니는 이유');
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
