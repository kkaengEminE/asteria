import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildArticleCopyText,
  buildGenerateRequest,
  buildMarkdownCopyText,
  getCopyButtonState,
  getCopyFeedbackState,
  getGenerateButtonState,
  renderError,
  renderResult,
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
    language: 'ko-KR'
  });
  const dogRequest = buildGenerateRequest({
    topic: '강아지가 산책 중 냄새를 오래 맡는 이유',
    magazine: 'dog',
    language: 'en-US'
  });

  assert.deepEqual(catRequest, {
    topic: '고양이가 밤에 뛰어다니는 이유',
    magazine: 'cat',
    language: 'ko-KR'
  });
  assert.equal(dogRequest.magazine, 'dog');
  assert.equal(dogRequest.language, 'en-US');
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

test('web result rendering shows useful generation sections', () => {
  const html = renderResult(createUiResultFixture());

  assert.match(html, /Workflow/);
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

test('web error rendering shows api errors', () => {
  const html = renderError('Generate request failed.');

  assert.match(html, /Error/);
  assert.match(html, /Generate request failed/);
});

function createUiResultFixture() {
  return {
    topic: '고양이가 밤에 뛰어다니는 이유',
    workflowStatus: 'success',
    contentGenerationMetadata: {
      qualityScore: 100,
      reviewResult: 'WARNING',
      reviewScore: 92,
      approvalDecision: 'REJECTED'
    },
    publishingPackage: {
      article: {
        title: 'Mock Article: 고양이가 밤에 뛰어다니는 이유',
        summary: '밤마다 우다다를 하는 이유 요약',
        body: '고양이는 밤에 에너지가 남거나 놀이가 부족할 때 활발해질 수 있습니다.'
      },
      summary: {
        text: '짧은 요약'
      },
      seo: {
        metaTitle: 'SEO 제목',
        metaDescription: 'SEO 설명'
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
