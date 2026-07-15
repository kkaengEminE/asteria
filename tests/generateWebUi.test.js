import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildArticleCopyText,
  buildGenerateRequest,
  buildMarkdownCopyText,
  addHistoryEntry,
  clearHistoryEntries,
  createHistoryEntry,
  buildCompareFields,
  canCompare,
  findDifferingCompareFields,
  formatRelativeTimestamp,
  getSelectedHistoryEntries,
  getCopyButtonState,
  getCopyFeedbackState,
  getGenerateButtonState,
  renderHistoryEntries,
  renderCompareView,
  renderError,
  renderResult,
  restoreHistoryEntry,
  toggleCompareSelection,
  validateGenerateForm
} from '../public/app.js';

test('web form validation rejects empty topic', () => {
  const result = validateGenerateForm({
    topic: '   ',
    magazine: 'cat',
    language: 'ko-KR'
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /Topic is required/);
});

test('web api request construction preserves cat dog and ko-KR selections', () => {
  const catRequest = buildGenerateRequest({
    topic: ' 고양이가 밤에 뛰어다니는 이유 ',
    magazine: 'cat',
    language: 'ko-KR',
    provider: 'mock'
  });
  const dogRequest = buildGenerateRequest({
    topic: '강아지가 산책 중 냄새를 오래 맡는 이유',
    magazine: 'dog',
    language: 'en-US',
    provider: 'gemini'
  });

  assert.deepEqual(catRequest, {
    topic: '고양이가 밤에 뛰어다니는 이유',
    magazine: 'cat',
    language: 'ko-KR',
    provider: 'mock'
  });
  assert.equal(dogRequest.magazine, 'dog');
  assert.equal(dogRequest.language, 'en-US');
  assert.equal(dogRequest.provider, 'gemini');
});

test('web api request construction supports openai provider selection', () => {
  const request = buildGenerateRequest({
    topic: 'indoor enrichment',
    magazine: 'cat',
    language: 'en-US',
    provider: 'openai'
  });

  assert.equal(request.provider, 'openai');
});

test('web loading state disables generate button', () => {
  assert.deepEqual(getGenerateButtonState(true), {
    disabled: true,
    label: 'Generating...'
  });
  assert.deepEqual(getGenerateButtonState(false), {
    disabled: false,
    label: 'Generate'
  });
});

test('web copy buttons are disabled before generation succeeds', () => {
  assert.deepEqual(getCopyButtonState(false), {
    disabled: true
  });
  assert.deepEqual(getCopyButtonState(true), {
    disabled: false
  });
});

test('web copy article includes title body and preserves Korean text', () => {
  const text = buildArticleCopyText(createUiResultFixture());

  assert.match(text, /Mock Article: 고양이가 밤에 뛰어다니는 이유/);
  assert.match(text, /고양이는 밤에 에너지가 남거나 놀이가 부족할 때/);
});

test('web copy markdown includes reusable sections and preserves Korean text', () => {
  const markdown = buildMarkdownCopyText(createUiResultFixture());

  assert.match(markdown, /^# Mock Article: 고양이가 밤에 뛰어다니는 이유/);
  assert.match(markdown, /## Summary/);
  assert.match(markdown, /밤마다 우다다를 하는 이유 요약|짧은 요약/);
  assert.match(markdown, /## Article/);
  assert.match(markdown, /고양이는 밤에 에너지가 남거나 놀이가 부족할 때/);
  assert.match(markdown, /## SEO/);
  assert.match(markdown, /Title: SEO 제목/);
  assert.match(markdown, /Description: SEO 설명/);
  assert.match(markdown, /## FAQ/);
  assert.match(markdown, /왜 밤에 뛰나요?/);
  assert.match(markdown, /놀이와 활동 리듬 때문일 수 있습니다/);
});

test('web copy feedback exposes copied and failed states', () => {
  assert.deepEqual(getCopyFeedbackState(true), {
    className: 'copy-feedback',
    text: 'Copied'
  });
  assert.deepEqual(getCopyFeedbackState(false), {
    className: 'copy-feedback error',
    text: 'Copy failed'
  });
});

test('web history insertion stores request metadata and full result', () => {
  const result = createUiResultFixture();
  const entry = createHistoryEntry({
    topic: ' 고양이가 밤에 뛰어다니는 이유 ',
    magazine: 'cat',
    language: 'ko-KR',
    provider: 'gemini'
  }, result, new Date('2026-07-15T00:00:00.000Z'));
  const entries = addHistoryEntry([], entry);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].topic, '고양이가 밤에 뛰어다니는 이유');
  assert.equal(entries[0].magazine, 'cat');
  assert.equal(entries[0].language, 'ko-KR');
  assert.equal(entries[0].provider, 'gemini');
  assert.equal(entries[0].generatedAt, '2026-07-15T00:00:00.000Z');
  assert.equal(entries[0].result, result);
});

test('web history restore returns stored result without requiring an api request', () => {
  let apiRequestCount = 0;
  const entry = createHistoryEntry({
    topic: '강아지가 산책 중 냄새를 오래 맡는 이유',
    magazine: 'dog',
    language: 'ko-KR',
    provider: 'mock'
  }, createUiResultFixture());
  const restored = restoreHistoryEntry([entry], entry.id);

  assert.equal(restored?.result, entry.result);
  assert.equal(restored?.magazine, 'dog');
  assert.equal(restored?.provider, 'mock');
  assert.equal(apiRequestCount, 0);
});

test('web history clear removes all session entries', () => {
  const entry = createHistoryEntry({
    topic: 'indoor enrichment',
    magazine: 'cat',
    language: 'en-US',
    provider: 'openai'
  }, createUiResultFixture());

  assert.equal(clearHistoryEntries(addHistoryEntry([], entry)).length, 0);
});

test('web history rendering shows metadata relative time and current highlight', () => {
  const entry = createHistoryEntry({
    topic: '고양이가 밤에 뛰어다니는 이유',
    magazine: 'cat',
    language: 'ko-KR',
    provider: 'gemini'
  }, createUiResultFixture(), new Date('2026-07-15T00:00:00.000Z'));
  const html = renderHistoryEntries([entry], entry.id, new Date('2026-07-15T00:05:00.000Z'));

  assert.match(html, /고양이가 밤에 뛰어다니는 이유/);
  assert.match(html, /gemini · cat · ko-KR · 5m ago/);
  assert.match(html, /history-item current/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /data-compare-id=/);
});

test('web history relative timestamps support session-friendly labels', () => {
  assert.equal(
    formatRelativeTimestamp('2026-07-15T00:00:30.000Z', new Date('2026-07-15T00:00:50.000Z')),
    'just now'
  );
  assert.equal(
    formatRelativeTimestamp('2026-07-15T00:00:00.000Z', new Date('2026-07-15T02:00:00.000Z')),
    '2h ago'
  );
});

test('web compare selection supports selecting history items with a max of three', () => {
  let selected = [];

  selected = toggleCompareSelection(selected, 'one', true);
  selected = toggleCompareSelection(selected, 'two', true);
  selected = toggleCompareSelection(selected, 'three', true);
  selected = toggleCompareSelection(selected, 'four', true);

  assert.deepEqual(selected, ['one', 'two', 'three']);
  assert.equal(canCompare(selected), true);

  selected = toggleCompareSelection(selected, 'two', false);

  assert.deepEqual(selected, ['one', 'three']);
  assert.equal(canCompare(selected), true);
  assert.equal(canCompare(['one']), false);
  assert.equal(canCompare(['one', 'two', 'three', 'four']), false);
});

test('web compare mode renders selected generations in parallel columns', () => {
  const first = createHistoryEntry({
    topic: '고양이가 밤에 뛰어다니는 이유',
    magazine: 'cat',
    language: 'ko-KR',
    provider: 'mock'
  }, createUiResultFixture({
    title: 'Cat Night Zoomies',
    summary: 'Cat summary',
    qualityScore: 91,
    approvalDecision: 'NEEDS_REVIEW'
  }), new Date('2026-07-15T00:00:00.000Z'));
  const second = createHistoryEntry({
    topic: '강아지가 산책 중 냄새를 오래 맡는 이유',
    magazine: 'dog',
    language: 'ko-KR',
    provider: 'gemini'
  }, createUiResultFixture({
    title: 'Dog Walk Sniffing',
    summary: 'Dog summary',
    qualityScore: 98,
    approvalDecision: 'APPROVED'
  }), new Date('2026-07-15T00:02:00.000Z'));
  const entries = getSelectedHistoryEntries([first, second], [first.id, second.id]);
  const html = renderCompareView(entries);

  assert.match(html, /Compare/);
  assert.match(html, /compare-grid/);
  assert.match(html, /Cat Night Zoomies/);
  assert.match(html, /Dog Walk Sniffing/);
  assert.match(html, /mock/);
  assert.match(html, /gemini/);
  assert.match(html, /Generation timestamp/);
  assert.match(html, /SEO title/);
  assert.match(html, /Instagram preview/);
  assert.match(html, /Podcast preview/);
});

test('web compare highlights configured differing fields', () => {
  const first = createHistoryEntry({
    topic: 'Topic A',
    magazine: 'cat',
    language: 'ko-KR',
    provider: 'mock'
  }, createUiResultFixture({
    title: 'Title A',
    summaryText: 'Summary A',
    qualityScore: 80,
    approvalDecision: 'REJECTED'
  }));
  const second = createHistoryEntry({
    topic: 'Topic B',
    magazine: 'cat',
    language: 'ko-KR',
    provider: 'openai'
  }, createUiResultFixture({
    title: 'Title B',
    summaryText: 'Summary B',
    qualityScore: 99,
    approvalDecision: 'APPROVED'
  }));
  const fields = buildCompareFields([first, second]);
  const differing = findDifferingCompareFields(fields, ['provider', 'title', 'summary', 'qualityScore', 'approval']);
  const html = renderCompareView([first, second]);

  assert.equal(differing.has('provider'), true);
  assert.equal(differing.has('title'), true);
  assert.equal(differing.has('summary'), true);
  assert.equal(differing.has('qualityScore'), true);
  assert.equal(differing.has('approval'), true);
  assert.match(html, /compare-different/);
});

test('web compare uses stored history entries without api requests', () => {
  let apiRequestCount = 0;
  const first = createHistoryEntry({
    topic: 'Topic A',
    magazine: 'cat',
    language: 'ko-KR',
    provider: 'mock'
  }, createUiResultFixture());
  const second = createHistoryEntry({
    topic: 'Topic B',
    magazine: 'dog',
    language: 'ko-KR',
    provider: 'mock'
  }, createUiResultFixture({ title: 'Second Result' }));
  const selected = getSelectedHistoryEntries([first, second], [first.id, second.id]);

  renderCompareView(selected);

  assert.equal(apiRequestCount, 0);
});

test('web result rendering shows useful generation sections', () => {
  const html = renderResult(createUiResultFixture());

  assert.match(html, /Workflow/);
  assert.match(html, /Provider/);
  assert.match(html, /mock-ai/);
  assert.match(html, /Elapsed/);
  assert.match(html, /123ms/);
  assert.match(html, /Mock Article: 고양이가 밤에 뛰어다니는 이유/);
  assert.match(html, /밤마다 우다다를 하는 이유/);
  assert.match(html, /SEO 제목/);
  assert.match(html, /cat-window\.jpg/);
  assert.match(html, /Monetization preview text/);
  assert.match(html, /WARNING \/ 92/);
  assert.match(html, /REJECTED/);
  assert.match(html, /Instagram/);
  assert.match(html, /Podcast/);
  assert.match(html, /Raw JSON/);
});

test('web result rendering shows unavailable provider workflow errors', () => {
  const html = renderResult({
    workflowStatus: 'failed',
    error: 'Gemini production mode is disabled. Set GEMINI_PRODUCTION_ENABLED=true.',
    previewReport: {
      channels: []
    }
  });

  assert.match(html, /Error/);
  assert.match(html, /GEMINI_PRODUCTION_ENABLED=true/);
});

test('web error rendering shows api errors', () => {
  const html = renderError('Generate request failed.');

  assert.match(html, /Error/);
  assert.match(html, /Generate request failed/);
});

function createUiResultFixture(overrides = {}) {
  return {
    topic: overrides.topic ?? '고양이가 밤에 뛰어다니는 이유',
    workflowStatus: 'success',
    contentGenerationMetadata: {
      providerName: overrides.providerName ?? 'mock-ai',
      generationDurationMs: 123,
      qualityScore: overrides.qualityScore ?? 100,
      reviewResult: 'WARNING',
      reviewScore: overrides.reviewScore ?? 92,
      approvalDecision: overrides.approvalDecision ?? 'REJECTED'
    },
    publishingPackage: {
      article: {
        title: overrides.title ?? 'Mock Article: 고양이가 밤에 뛰어다니는 이유',
        summary: overrides.summary ?? '밤마다 우다다를 하는 이유 요약',
        body: overrides.body ?? '고양이는 밤에 에너지가 남거나 놀이가 부족할 때 활발해질 수 있습니다.'
      },
      summary: {
        text: overrides.summaryText ?? '짧은 요약'
      },
      seo: {
        metaTitle: overrides.seoTitle ?? 'SEO 제목',
        metaDescription: overrides.seoDescription ?? 'SEO 설명'
      },
      faq: [
        {
          question: '왜 밤에 뛰나요?',
          answer: '놀이와 활동 리듬 때문일 수 있습니다.'
        }
      ]
    },
    selectedImage: {
      filename: 'cat-window.jpg',
      category: 'hero',
      tags: ['cat', 'window']
    },
    monetizationPreview: 'Monetization preview text',
    previewReport: {
      channels: [
        {
          type: 'instagram',
          data: {
            shortCaption: '짧은 캡션',
            cta: '저장해두세요'
          }
        },
        {
          type: 'podcast',
          data: {
            episodeTitle: '오디오 브리프',
            estimatedDuration: '55s'
          }
        }
      ]
    }
  };
}
