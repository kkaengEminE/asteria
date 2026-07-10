import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import {
  formatQualityLabReport,
  loadTopics,
  parseQualityLabArgs,
  runQualityLabCli,
  summarizeQualityLabResults,
  type QualityLabTopicResult
} from '../scripts/quality-lab.ts';

test('quality lab parses topics file, ai mode, language, and output path', () => {
  const parsed = parseQualityLabArgs([
    'topics.txt',
    '--magazine',
    'cat',
    '--ai',
    'gemini',
    '--language',
    'ko-KR',
    '--output',
    'reports/out.md'
  ]);

  assert.equal(parsed.topicsFile, 'topics.txt');
  assert.equal(parsed.magazine, 'cat');
  assert.equal(parsed.aiMode, 'gemini');
  assert.equal(parsed.language, 'ko-KR');
  assert.equal(parsed.output, 'reports/out.md');
});

test('quality lab loads topics while ignoring blanks and comments', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asteria-quality-lab-'));
  const path = join(dir, 'topics.txt');

  await writeFile(path, [
    '# Cat topics',
    '',
    '고양이가 밤에 뛰어다니는 이유',
    '실내 고양이 놀이 루틴'
  ].join('\n'));

  const topics = await loadTopics(path);

  assert.deepEqual(topics, ['고양이가 밤에 뛰어다니는 이유', '실내 고양이 놀이 루틴']);
});

test('quality lab summarizes scores, approvals, failures, and retry count', () => {
  const summary = summarizeQualityLabResults([
    createTopicResult('topic one', 100, 90, 'APPROVED', 0),
    createTopicResult('topic two', 80, 70, 'NEEDS_REVIEW', 2),
    createTopicResult('topic three', undefined, undefined, undefined, 0, 'failed')
  ]);

  assert.equal(summary.topicCount, 3);
  assert.equal(summary.averageQualityScore, 90);
  assert.equal(summary.averageReviewScore, 80);
  assert.deepEqual(summary.approvalDistribution, {
    APPROVED: 1,
    NEEDS_REVIEW: 1,
    UNAVAILABLE: 1
  });
  assert.deepEqual(summary.failedTopics, ['topic three']);
  assert.equal(summary.retryCount, 2);
});

test('quality lab formats markdown report with topic results', () => {
  const results = [
    createTopicResult('고양이가 밤에 뛰어다니는 이유', 100, 92, 'REJECTED', 1)
  ];
  const markdown = formatQualityLabReport({
    topicsFile: 'topics.txt',
    magazine: 'cat',
    aiMode: 'gemini',
    language: 'ko-KR',
    results,
    summary: summarizeQualityLabResults(results)
  });

  assert.match(markdown, /# Asteria Quality Lab Report/);
  assert.match(markdown, /Magazine: cat/);
  assert.match(markdown, /AI Mode: gemini/);
  assert.match(markdown, /Language: ko-KR/);
  assert.match(markdown, /Average Quality Score: 100/);
  assert.match(markdown, /Approval Distribution: REJECTED=1/);
  assert.match(markdown, /### 1\. 고양이가 밤에 뛰어다니는 이유/);
  assert.match(markdown, /Title: 고양이가 밤에 뛰어다니는 이유/);
  assert.match(markdown, /Token Usage: prompt=10, completion=20, total=30/);
});

test('quality lab runs dog magazine mode', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asteria-quality-lab-dog-'));
  const topicsPath = join(dir, 'dog-topics.txt');
  const outputPath = join(dir, 'dog-report.md');

  await writeFile(topicsPath, '강아지가 산책 중 냄새를 오래 맡는 이유\n');

  await runQualityLabCli([
    topicsPath,
    '--magazine',
    'dog',
    '--language',
    'ko-KR',
    '--output',
    outputPath
  ]);

  const report = await readFile(outputPath, 'utf8');

  assert.match(report, /Magazine: dog/);
  assert.match(report, /강아지가 산책 중 냄새를 오래 맡는 이유/);
  assert.match(report, /Title: Mock Article: 강아지가 산책 중 냄새를 오래 맡는 이유/);
});

function createTopicResult(
  topic: string,
  qualityScore?: number,
  reviewScore?: number,
  approvalDecision?: string,
  retryCount = 0,
  workflowStatus: 'success' | 'failed' = 'success'
): QualityLabTopicResult {
  return {
    topic,
    result: {
      topic,
      workflowStatus,
      executedSteps: [],
      error: workflowStatus === 'failed' ? 'Failed topic' : undefined,
      publishingPackage: workflowStatus === 'success'
        ? {
            article: {
              title: topic,
              summary: `${topic} summary`,
              body: `${topic} body`,
              slug: topic,
              language: 'ko-KR',
              createdAt: '2026-07-08T00:00:00.000Z',
              metadata: {
                status: 'draft',
                tags: []
              }
            },
            summary: {
              text: `${topic} package summary`
            },
            seo: {
              metaTitle: topic,
              metaDescription: `${topic} description`,
              keywords: ['cat']
            },
            faq: [
              {
                question: '질문입니다?',
                answer: '답변입니다.'
              }
            ],
            imagePrompt: {
              prompt: 'image'
            },
            productPrompt: {
              prompt: 'product'
            }
          }
        : undefined,
      contentGenerationMetadata: {
        qualityScore,
        reviewScore,
        approvalDecision: approvalDecision as any,
        retryCount,
        generationDurationMs: 123,
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        }
      }
    }
  };
}
