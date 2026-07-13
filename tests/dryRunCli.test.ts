import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDryRunReport, parseDryRunArgs } from '../scripts/dry-run.ts';

test('dry-run parser supports ai mode and language option', () => {
  const parsed = parseDryRunArgs([
    '--magazine',
    'cat',
    '--ai',
    'gemini',
    '--affiliate',
    'coupang',
    '--language',
    'ko-KR',
    '고양이가 밤에 뛰어다니는 이유'
  ]);

  assert.equal(parsed.magazine, 'cat');
  assert.equal(parsed.aiMode, 'gemini');
  assert.equal(parsed.affiliateMode, 'coupang');
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
      operationState: {
        scheduledJobCount: 1,
        activeJobCount: 1,
        duplicateDetected: false,
        lookupSucceeded: true,
        retryAttemptCount: 0
      },
      message: 'Queue item queue-1 scheduled for 2026-07-10T09:00:00.000Z.'
    }
  }));

  assert.match(report, /Scheduler:/);
  assert.match(report, /Result: scheduled/);
  assert.match(report, /Job ID: schedule-1/);
  assert.match(report, /Scheduled Job Count: 1/);
  assert.match(report, /Active Job Count: 1/);
  assert.match(report, /Lookup Succeeded: true/);
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

test('dry-run report displays publisher preview information when available', () => {
  const report = formatDryRunReport(createDryRunResultFixture('mock-ai', {
    publisherResult: {
      status: 'PREVIEW',
      publisher: 'dry-run-publisher',
      mode: 'preview',
      destination: {
        type: 'wordpress',
        name: 'Cat Magazine WordPress',
        enabled: true
      },
      publishId: 'preview-cat-magazine-wordpress-topic',
      previewUrl: 'https://preview.asteria.local/wordpress/preview-cat-magazine-wordpress-topic',
      message: 'Dry-run publish preview generated.',
      metadata: {
        adapter: 'dry-run',
        targetSite: 'preview.asteria.local',
        publishingEnabled: false
      }
    }
  }));

  assert.match(report, /Publisher:/);
  assert.match(report, /Publisher Adapter: dry-run/);
  assert.match(report, /Publisher Mode: preview/);
  assert.match(report, /Preview URL: https:\/\/preview\.asteria\.local\/wordpress\/preview-cat-magazine-wordpress-topic/);
  assert.match(report, /Target Site: preview\.asteria\.local/);
  assert.match(report, /Publishing Enabled: false/);
  assert.match(report, /Publish Result: PREVIEW/);
  assert.match(report, /Publish ID: preview-cat-magazine-wordpress-topic/);
});

test('dry-run report displays monetization provider diagnostics', () => {
  const report = formatDryRunReport(createDryRunResultFixture('mock-ai', {
    recommendedProducts: [
      {
        id: 'cat-puzzle-feeder',
        name: 'Cat Puzzle Feeder',
        tags: ['cat'],
        reason: 'Matched product.',
        confidence: 1,
        priority: 1,
        score: 20
      }
    ],
    affiliateLinks: [
      {
        productId: 'cat-puzzle-feeder',
        provider: 'coupang',
        url: 'https://cou.pang/affiliate/cat-puzzle-feeder',
        label: 'Cat Puzzle Feeder',
        disclosure: 'Disclosure',
        metadata: {
          dryRun: false
        }
      }
    ],
    monetizationDiagnostics: {
      provider: 'cat-coupang-affiliate',
      productionEnabled: true,
      requestCount: 2,
      retryCount: 1,
      returnedProductCount: 1,
      failureReason: undefined
    }
  }));

  assert.match(report, /Provider: cat-coupang-affiliate/);
  assert.match(report, /Request Count: 2/);
  assert.match(report, /Retry Count: 1/);
  assert.match(report, /Returned Products: 1/);
  assert.match(report, /Affiliate Link: https:\/\/cou\.pang\/affiliate\/cat-puzzle-feeder/);
});

test('dry-run report displays metrics summary', () => {
  const report = formatDryRunReport(createDryRunResultFixture('mock-ai', {
    metricsSnapshot: {
      generatedAt: '2026-07-10T10:00:00.000Z',
      counters: [
        {
          name: 'content_generation.started',
          value: 1
        }
      ],
      durations: [
        {
          name: 'content_generation.duration_ms',
          count: 1,
          totalMs: 42,
          averageMs: 42,
          minMs: 42,
          maxMs: 42
        }
      ],
      failures: [
        {
          name: 'publishing_queue.rejected',
          count: 1,
          lastFailureReason: 'Approval decision was NEEDS_REVIEW.'
        }
      ],
      events: []
    }
  }));

  assert.match(report, /Metrics Summary:/);
  assert.match(report, /Generated At: 2026-07-10T10:00:00.000Z/);
  assert.match(report, /Counters: content_generation\.started=1/);
  assert.match(report, /content_generation\.duration_ms: count=1, avg=42ms, total=42ms/);
  assert.match(report, /publishing_queue\.rejected: count=1, last=Approval decision was NEEDS_REVIEW\./);
});

test('dry-run report displays instagram preview output', () => {
  const report = formatDryRunReport(createDryRunResultFixture('mock-ai', {
    instagramPreview: {
      magazineId: 'cat',
      magazineName: 'Cat Magazine',
      topic: 'indoor enrichment',
      language: 'en-US',
      post: {
        caption: {
          short: 'Indoor Cat Enrichment Guide - Warm and practical',
          long: 'Indoor Cat Enrichment Guide\n\nA practical summary.\n\nSave this guide.',
          cta: 'Save this cat guide.'
        },
        hashtags: {
          primary: ['#catcare', '#enrichment'],
          secondary: ['#cat', '#indoorcats'],
          branded: ['#CatMagazine', '#asteria']
        },
        altText: 'Cat Magazine editorial image for Indoor Cat Enrichment Guide.',
        imageSelectionReference: 'cat-image-1:cat-window.jpg'
      },
      source: {
        articleTitle: 'Indoor Cat Enrichment Guide',
        seoKeywords: ['cat care', 'enrichment']
      }
    }
  }));

  assert.match(report, /Instagram Preview:/);
  assert.match(report, /Short Caption: Indoor Cat Enrichment Guide - Warm and practical/);
  assert.match(report, /Primary Hashtags: #catcare #enrichment/);
  assert.match(report, /Alt Text: Cat Magazine editorial image/);
  assert.match(report, /Image Reference: cat-image-1:cat-window\.jpg/);
});

test('dry-run report displays podcast preview output', () => {
  const report = formatDryRunReport(createDryRunResultFixture('mock-ai', {
    podcastPreview: {
      episode: {
        title: 'Indoor Cat Enrichment Guide - audio brief',
        language: 'en-US',
        script: {
          spokenIntro: 'Welcome to Cat Magazine.',
          spokenOutro: 'Save this cat guide.',
          estimatedDurationSeconds: 42,
          chapters: [
            {
              order: 1,
              title: 'Overview',
              summary: 'A practical summary.'
            }
          ]
        }
      },
      ttsRequest: {
        voice: 'warm-editorial-neutral',
        segments: [
          {
            id: 'intro',
            role: 'intro',
            estimatedDurationSeconds: 8
          }
        ]
      },
      source: {
        instagramShortCaption: 'Indoor Cat Enrichment Guide - Warm and practical'
      }
    }
  }));

  assert.match(report, /Podcast Preview:/);
  assert.match(report, /Episode Title: Indoor Cat Enrichment Guide - audio brief/);
  assert.match(report, /Voice: warm-editorial-neutral/);
  assert.match(report, /Estimated Duration: 42s/);
  assert.match(report, /1\. Overview: A practical summary\./);
  assert.match(report, /intro \[intro\] 8s/);
  assert.match(report, /Instagram Hook Used: Indoor Cat Enrichment Guide - Warm and practical/);
});

test('dry-run result exposes channel previews through preview aggregation', () => {
  const result = createDryRunResultFixture('mock-ai', {
    instagramPreview: {
      magazineId: 'cat',
      magazineName: 'Cat Magazine',
      topic: 'indoor enrichment',
      language: 'en-US',
      post: {
        caption: {
          short: 'Instagram preview',
          long: 'Instagram preview long',
          cta: 'Save this guide.'
        },
        hashtags: {
          primary: ['#catcare'],
          secondary: [],
          branded: []
        },
        altText: 'Alt text'
      },
      source: {
        articleTitle: 'Article',
        seoKeywords: []
      }
    },
    podcastPreview: {
      episode: {
        title: 'Podcast preview',
        language: 'en-US',
        script: {
          spokenIntro: 'Intro',
          spokenOutro: 'Outro',
          estimatedDurationSeconds: 12,
          chapters: []
        }
      },
      ttsRequest: {
        voice: 'warm-editorial-neutral',
        segments: []
      },
      source: {}
    }
  });

  assert.deepEqual(result.previewReport.channels.map((preview: any) => preview.channel), ['instagram', 'podcast']);
});

function createDryRunResultFixture(providerName: string, overrides: Record<string, unknown> = {}): any {
  const result: any = {
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

  return {
    ...result,
    previewReport: overrides.previewReport ?? {
      content: {
        renderedPromptPreview: result.renderedPromptPreview,
        articlePreview: result.articlePreview,
        seoPreview: result.seoPreview,
        publishingPackage: result.publishingPackage,
        metadata: result.contentGenerationMetadata
      },
      media: {
        selectedImage: result.selectedImage,
        imageSelectionReason: result.imageSelectionReason,
        imagePreview: result.imagePreview
      },
      monetization: {
        recommendedProducts: result.recommendedProducts,
        affiliateLinks: result.affiliateLinks,
        diagnostics: result.monetizationDiagnostics,
        preview: result.monetizationPreview,
        disclosure: result.affiliateDisclosure
      },
      channels: [
        result.instagramPreview
          ? {
              id: 'instagram',
              title: 'Instagram Preview',
              type: 'channel',
              channel: 'instagram',
              payload: result.instagramPreview
            }
          : undefined,
        result.podcastPreview
          ? {
              id: 'podcast',
              title: 'Podcast Preview',
              type: 'channel',
              channel: 'podcast',
              payload: result.podcastPreview
            }
          : undefined
      ].filter(Boolean),
      publishing: {
        publishPreview: result.publishPreview,
        queueResult: result.queueResult,
        schedulerResult: result.schedulerResult,
        executionResult: result.executionResult,
        publisherResult: result.publisherResult
      },
      observability: {
        metricsSnapshot: result.metricsSnapshot,
        auditTimeline: result.auditTimeline,
        retryMetadata: result.retryMetadata
      }
    }
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
