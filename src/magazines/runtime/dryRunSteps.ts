import { loadMagazineConfig } from '../../config/index.ts';
import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { Publisher, ResearchProvider } from '../../core/index.ts';
import type { PublishingDestination } from '../../core/types.ts';
import type { ApprovalResult } from '../../domain/approval/index.ts';
import type { PublishingPackage } from '../../domain/content/index.ts';
import type { ImageAspectRatio, ImageDomainLibrary, ImageSelectionCriteria } from '../../domain/image/index.ts';
import { MagazineProfileRegistry, type MagazineProfile } from '../../domain/magazineProfile/index.ts';
import type { MonetizationProvider, ProductSearchQuery } from '../../domain/monetization/index.ts';
import type { PublishingQueueResult } from '../../domain/publishingQueue/index.ts';
import type { AIProvider } from '../../providers/ai/index.ts';
import { PromptManager } from '../../prompts/index.ts';
import type { AuditLog } from '../../services/auditLog/index.ts';
import { DryRunStepFactory, requireWorkflowData } from '../../services/dryRun/index.ts';
import { PublishingWorkflow } from '../../services/publishing/index.ts';
import { PublishingQueue } from '../../services/publishingQueue/index.ts';
import { RetryService } from '../../services/retry/index.ts';
import { ScheduledJobExecutor, SchedulerService } from '../../services/scheduler/index.ts';
import { ContentGenerationWorkflow } from '../../workflows/contentGeneration/index.ts';
import type { WorkflowStep } from '../../workflows/index.ts';

export interface MagazineDryRunStepOptions {
  topic: string;
  magazineSlug?: string;
  language?: string;
  rootDir?: string;
  promptKey?: string;
  researchProvider: ResearchProvider;
  aiProvider: AIProvider;
  publisher: Publisher;
  imageLibrary: ImageDomainLibrary;
  monetizationProvider: MonetizationProvider;
  auditLog?: AuditLog;
}

export function createMagazineDryRunSteps(options: MagazineDryRunStepOptions): WorkflowStep[] {
  const stepFactory = new DryRunStepFactory();
  const publishingQueue = new PublishingQueue({
    auditLog: options.auditLog
  });
  const schedulerService = new SchedulerService({
    auditLog: options.auditLog,
    queue: publishingQueue
  });
  const scheduledJobExecutor = new ScheduledJobExecutor({
    auditLog: options.auditLog,
    queue: publishingQueue,
    scheduler: schedulerService
  });

  return [
    createLoadConfigStep(stepFactory, options),
    createLoadPromptStep(stepFactory, options),
    createResearchStep(stepFactory, options),
    createGeneratePublishingPackageStep(stepFactory, options),
    createSelectImageStep(stepFactory, options),
    createGenerateArticleStep(stepFactory, options),
    createGenerateSeoStep(stepFactory, options),
    createGenerateMonetizationPreviewStep(stepFactory, options),
    createPublishPreviewStep(stepFactory, options, publishingQueue),
    createSchedulePreviewStep(stepFactory, options, schedulerService),
    createExecutionPreviewStep(stepFactory, options, scheduledJobExecutor)
  ];
}

function createGeneratePublishingPackageStep(
  stepFactory: DryRunStepFactory,
  options: MagazineDryRunStepOptions
): WorkflowStep {
  return stepFactory.createStep({
    name: 'Generate Publishing Package',
    async execute(context) {
      const magazineConfig = requireWorkflowData<MagazineConfig>(context, 'magazineConfig');
      const magazineProfile = requireWorkflowData<MagazineProfile>(context, 'magazineProfile');
      const language = options.language ?? magazineProfile.language;
      const workflow = new ContentGenerationWorkflow({
        aiProvider: options.aiProvider,
        promptProfile: magazineProfile.promptProfile ?? magazineProfile.style,
        auditLog: options.auditLog
      });
      const publishingPackage = await workflow.execute({
        topic: options.topic,
        language,
        audience: magazineProfile.audience,
        tone: magazineProfile.tone,
        magazineName: magazineProfile.name,
        createdAt: '2026-07-08T00:00:00.000Z',
        metadata: {
          dryRun: true,
          magazineSlug: magazineProfile.id,
          magazineProfile: {
            id: magazineProfile.id,
            persona: magazineProfile.persona,
            style: magazineProfile.style,
            seoPolicy: magazineProfile.seoPolicy,
            imageStyle: magazineProfile.imageStyle,
            affiliatePolicy: magazineProfile.affiliatePolicy,
            categories: magazineProfile.categories
          }
        }
      });
      const retryMetadata = await createDryRunRetryMetadata();

      return {
        ...context,
        data: {
          ...context.data,
          publishingPackage,
          retryMetadata,
          contentGenerationMetadata: {
            providerName: publishingPackage.metadata?.providerName,
            modelName: publishingPackage.metadata?.modelName,
            language: publishingPackage.metadata?.language,
            tokenUsage: publishingPackage.metadata?.tokenUsage,
            promptProfile: publishingPackage.metadata?.promptProfile,
            promptId: publishingPackage.metadata?.promptId,
            promptIds: publishingPackage.metadata?.promptIds,
            promptVersion: publishingPackage.metadata?.promptVersion,
            renderedVariables: publishingPackage.metadata?.renderedVariables,
            renderedPromptPreview: publishingPackage.metadata?.renderedPromptPreview,
            composedPromptPreview: publishingPackage.metadata?.composedPromptPreview,
            retryCount: publishingPackage.metadata?.retryCount,
            validationResult: publishingPackage.metadata?.validationResult,
            validationErrors: publishingPackage.metadata?.validationErrors,
            qualityScore: publishingPackage.metadata?.qualityScore,
            qualityReport: publishingPackage.metadata?.qualityReport,
            editorialReview: publishingPackage.metadata?.editorialReview,
            reviewScore: publishingPackage.metadata?.reviewScore,
            reviewResult: publishingPackage.metadata?.reviewResult,
            reviewSummary: publishingPackage.metadata?.reviewSummary,
            reviewIssues: publishingPackage.metadata?.reviewIssues,
            realGenerationReview: publishingPackage.metadata?.realGenerationReview,
            realGenerationThresholdResult: publishingPackage.metadata?.realGenerationThresholdResult,
            approvalResult: publishingPackage.metadata?.approvalResult,
            approvalDecision: publishingPackage.metadata?.approvalDecision,
            generationDurationMs: publishingPackage.metadata?.generationDurationMs
          }
        }
      };
    }
  });
}

async function createDryRunRetryMetadata() {
  const retryService = new RetryService();

  return retryService.execute(
    (attemptNumber) => {
      if (attemptNumber === 1) {
        const error = new Error('Dry-run retry probe failed once.');
        (error as Error & { code: string; retryable: boolean }).code = 'dry_run_probe';
        (error as Error & { code: string; retryable: boolean }).retryable = true;
        throw error;
      }

      return 'Dry-run retry probe completed.';
    },
    {
      policy: {
        maxAttempts: 2,
        delayMs: 25,
        retryableReasons: ['dry_run_probe']
      }
    }
  );
}

function createSelectImageStep(stepFactory: DryRunStepFactory, options: MagazineDryRunStepOptions): WorkflowStep {
  return stepFactory.createStep({
    name: 'Select Image',
    async execute(context) {
      const magazineProfile = requireWorkflowData<MagazineProfile>(context, 'magazineProfile');
      const criteria = createMagazineImageSelectionCriteria(magazineProfile, options.topic);
      const candidates = await options.imageLibrary.search({
        text: magazineProfile.id,
        criteria: {
          tags: [magazineProfile.id],
          category: criteria.category,
          minimumRating: criteria.minimumRating
        }
      });
      const selectedImage = await options.imageLibrary.select(candidates, criteria);

      if (!selectedImage) {
        throw new Error(`No image matched ${magazineProfile.name} dry-run criteria.`);
      }

      const score = await options.imageLibrary.score(selectedImage, criteria);

      return {
        ...context,
        data: {
          ...context.data,
          imageCandidates: candidates,
          selectedImage,
          imageSelectionCriteria: criteria,
          imageSelectionReason: {
            score,
            reasons: [
              `matched topic: ${options.topic}`,
              `matched tags: ${(criteria.tags ?? []).join(', ')}`,
              `category preference: ${criteria.category}`,
              `minimum rating: ${criteria.minimumRating}`,
              selectedImage.metadata.favorite ? 'favorite image' : 'not marked favorite'
            ]
          }
        }
      };
    }
  });
}

function createLoadConfigStep(stepFactory: DryRunStepFactory, options: MagazineDryRunStepOptions): WorkflowStep {
  return stepFactory.createStep({
    name: 'Load Config',
    async execute(context) {
      const magazineConfig = await loadMagazineConfig(options.magazineSlug ?? 'cat', { rootDir: options.rootDir });
      const profileRegistry = new MagazineProfileRegistry();
      const magazineProfile = await profileRegistry.loadProfile(options.magazineSlug ?? magazineConfig.slug, {
        rootDir: options.rootDir
      });

      return {
        ...context,
        magazineSlug: magazineProfile.id,
        data: {
          ...context.data,
          magazineConfig: {
            ...magazineConfig,
            name: magazineProfile.name,
            slug: magazineProfile.id,
            language: magazineProfile.language,
            audience: magazineProfile.audience,
            tone: magazineProfile.tone,
            topics: magazineProfile.categories
          },
          magazineProfile
        }
      };
    }
  });
}

function createLoadPromptStep(stepFactory: DryRunStepFactory, options: MagazineDryRunStepOptions): WorkflowStep {
  return stepFactory.createStep({
    name: 'Load Prompt',
    async execute(context) {
      const magazineConfig = requireWorkflowData<MagazineConfig>(context, 'magazineConfig');
      const magazineProfile = requireWorkflowData<MagazineProfile>(context, 'magazineProfile');
      const promptManager = new PromptManager();

      await promptManager.load({ magazineSlug: magazineProfile.id });

      const articlePrompt = promptManager.render(options.promptKey ?? 'article', {
        magazineName: magazineProfile.name,
        audience: magazineProfile.audience,
        tone: magazineProfile.tone,
        topic: options.topic
      });
      const seoPrompt = promptManager.render('seo', {
        magazineName: magazineProfile.name,
        topic: options.topic,
        primaryKeyword: options.topic
      });

      return {
        ...context,
        data: {
          ...context.data,
          articlePrompt,
          seoPrompt
        }
      };
    }
  });
}

function createResearchStep(stepFactory: DryRunStepFactory, options: MagazineDryRunStepOptions): WorkflowStep {
  return stepFactory.createStep({
    name: 'Research',
    async execute(context) {
      const researchResults = await options.researchProvider.search({
        topic: options.topic,
        language: options.language ?? getContextMagazineProfile(context.data.magazineProfile)?.language ?? 'en-US'
      });

      return {
        ...context,
        data: {
          ...context.data,
          researchResults
        }
      };
    }
  });
}

function getContextMagazineProfile(value: unknown): MagazineProfile | undefined {
  return value && typeof value === 'object' ? value as MagazineProfile : undefined;
}

function createGenerateArticleStep(stepFactory: DryRunStepFactory, options: MagazineDryRunStepOptions): WorkflowStep {
  return stepFactory.createStep({
    name: 'Generate Article',
    async execute(context) {
      const articlePrompt = requireWorkflowData<string>(context, 'articlePrompt');
      const response = await options.aiProvider.generate({
        userPrompt: articlePrompt,
        metadata: {
          dryRun: true,
          contentType: 'article'
        }
      });

      return {
        ...context,
        data: {
          ...context.data,
          articlePreview: response.content,
          articleAIResponse: response
        }
      };
    }
  });
}

function createGenerateSeoStep(stepFactory: DryRunStepFactory, options: MagazineDryRunStepOptions): WorkflowStep {
  return stepFactory.createStep({
    name: 'Generate SEO',
    async execute(context) {
      const seoPrompt = requireWorkflowData<string>(context, 'seoPrompt');
      const response = await options.aiProvider.generate({
        userPrompt: seoPrompt,
        metadata: {
          dryRun: true,
          contentType: 'seo'
        }
      });

      return {
        ...context,
        data: {
          ...context.data,
          seoPreview: response.content,
          seoAIResponse: response
        }
      };
    }
  });
}

function createGenerateMonetizationPreviewStep(
  stepFactory: DryRunStepFactory,
  options: MagazineDryRunStepOptions
): WorkflowStep {
  return stepFactory.createStep({
    name: 'Generate Monetization Preview',
    async execute(context) {
      const magazineProfile = requireWorkflowData<MagazineProfile>(context, 'magazineProfile');
      const query = createMagazineProductSearchQuery(magazineProfile, options.topic);
      const recommendations = await options.monetizationProvider.recommendProducts(query);
      const monetizationResult = await options.monetizationProvider.previewRecommendation(options.topic, recommendations);
      const affiliateLinks = recommendations
        .map((recommendation) => recommendation.affiliateLink)
        .filter((link): link is NonNullable<typeof link> => Boolean(link));

      for (const link of affiliateLinks) {
        if (!link.url.startsWith('mock://')) {
          throw new Error(`${magazineProfile.name} dry run only allows mock affiliate links.`);
        }
      }

      return {
        ...context,
        data: {
          ...context.data,
          productSearchQuery: query,
          recommendations,
          affiliateLinks,
          monetizationPreview: monetizationResult.preview,
          affiliateDisclosure: createAffiliateDisclosure(affiliateLinks.length)
        }
      };
    }
  });
}

function createPublishPreviewStep(
  stepFactory: DryRunStepFactory,
  options: MagazineDryRunStepOptions,
  publishingQueue: PublishingQueue
): WorkflowStep {
  return stepFactory.createStep({
    name: 'Publish Preview',
    async execute(context) {
      const magazineConfig = requireWorkflowData<MagazineConfig>(context, 'magazineConfig');
      const publishingPackage = requireWorkflowData<PublishingPackage>(context, 'publishingPackage');
      const destination = magazineConfig.publishingDestinations[0] ?? createDryRunDestination();
      const approvalResult = publishingPackage.metadata?.approvalResult as ApprovalResult | undefined;
      const publishingWorkflow = new PublishingWorkflow({
        publisher: options.publisher,
        queue: publishingQueue,
        config: {
          dryRun: true,
          publishingEnabled: false,
          requireApproval: true
        }
      });
      const publishPreview = await publishingWorkflow.execute({
        publishingPackage,
        approvalResult,
        destination,
        metadata: {
          magazineSlug: magazineConfig.slug,
          dryRun: true
        }
      });

      return {
        ...context,
        data: {
          ...context.data,
          publishPreview,
          queueResult: publishPreview.metadata?.queueResult,
          auditTimeline: options.auditLog?.listEvents()
        }
      };
    }
  });
}

function createSchedulePreviewStep(
  stepFactory: DryRunStepFactory,
  options: MagazineDryRunStepOptions,
  schedulerService: SchedulerService
): WorkflowStep {
  return stepFactory.createStep({
    name: 'Schedule Preview',
    async execute(context) {
      const queueResult = requireWorkflowData<PublishingQueueResult>(context, 'queueResult');
      const queueItem = queueResult.item;

      if (!queueItem) {
        return {
          ...context,
          data: {
            ...context.data,
            schedulerResult: {
              status: 'rejected',
              message: `Scheduling requires a queued item. Queue result: ${queueResult.status}.`
            },
            auditTimeline: options.auditLog?.listEvents()
          }
        };
      }

      const schedulerResult = await schedulerService.schedule({
        queueItem,
        policy: {
          scheduledFor: '2026-07-10T09:00:00.000Z',
          timezone: 'UTC',
          metadata: {
            dryRun: true
          }
        },
        metadata: {
          dryRun: true,
          magazineSlug: context.magazineSlug,
          destinationName: queueItem.destination.name
        },
        now: '2026-07-10T00:00:00.000Z'
      });

      return {
        ...context,
        data: {
          ...context.data,
          schedulerResult,
          queueResult: schedulerResult.queueResult ?? queueResult,
          auditTimeline: options.auditLog?.listEvents()
        }
      };
    }
  });
}

function createExecutionPreviewStep(
  stepFactory: DryRunStepFactory,
  options: MagazineDryRunStepOptions,
  scheduledJobExecutor: ScheduledJobExecutor
): WorkflowStep {
  return stepFactory.createStep({
    name: 'Execution Preview',
    async execute(context) {
      const schedulerResult = requireWorkflowData<ReturnType<SchedulerService['schedule']> extends Promise<infer Result> ? Result : never>(
        context,
        'schedulerResult'
      );

      if (!schedulerResult.job) {
        return {
          ...context,
          data: {
            ...context.data,
            executionResult: {
              status: 'SKIPPED',
              due: false,
              attemptCount: 0,
              retryCount: 0,
              message: `Execution requires a scheduled job. Scheduler result: ${schedulerResult.status}.`,
              failure: {
                code: 'missing_scheduled_job',
                reason: `Execution requires a scheduled job. Scheduler result: ${schedulerResult.status}.`,
                retryable: false
              }
            },
            auditTimeline: options.auditLog?.listEvents()
          }
        };
      }

      const executionResult = await scheduledJobExecutor.execute({
        jobId: schedulerResult.job.id,
        now: '2026-07-10T10:00:00.000Z',
        retryPolicy: {
          maxAttempts: 2,
          delayMs: 25,
          retryableReasons: ['dry_run_execution_probe']
        },
        metadata: {
          dryRun: true,
          magazineSlug: context.magazineSlug
        },
        operation: () => ({
          status: 'preview',
          message: 'Scheduled execution preview completed. Publishing remains disabled.'
        })
      });

      return {
        ...context,
        data: {
          ...context.data,
          executionResult,
          queueResult: executionResult.queueResult ?? context.data.queueResult,
          auditTimeline: options.auditLog?.listEvents()
        }
      };
    }
  });
}

function createMagazineImageSelectionCriteria(profile: MagazineProfile, topic: string): ImageSelectionCriteria {
  const topicTags = extractMagazineTopicTags(profile.id, topic);

  return {
    topic,
    tags: [profile.id, ...topicTags],
    category: 'hero',
    aspectRatio: normalizeAspectRatio(profile.imageStyle.preferredOrientation),
    minimumRating: 4,
    randomWeight: 0.2
  };
}

function normalizeAspectRatio(value: string | undefined): ImageAspectRatio {
  return value === 'portrait' || value === 'square' || value === 'any' ? value : 'landscape';
}

function createMagazineProductSearchQuery(profile: MagazineProfile, topic: string): ProductSearchQuery {
  const topicTags = extractMagazineTopicTags(profile.id, topic);
  const preferredCategory = profile.affiliatePolicy.preferredCategories[0] ?? `${profile.id}-care`;

  return {
    topic: topicTags[0] ?? profile.id,
    category: preferredCategory,
    tags: [profile.id],
    minimumRating: 4,
    limit: 3
  };
}

function extractMagazineTopicTags(magazineSlug: string, topic: string): string[] {
  const knownTags = magazineSlug === 'dog' ? [
    'walk',
    'walking',
    'sniff',
    'sniffing',
    'smell',
    'scent',
    'training',
    'treat',
    'food',
    'play',
    'toy',
    'health',
    'grooming',
    'enrichment',
    'home'
  ] : [
    'sleep',
    'food',
    'play',
    'toy',
    'cute',
    'window',
    'health',
    'enrichment',
    'fountain',
    'water',
    'litter',
    'scratcher',
    'grooming',
    'brush',
    'indoor'
  ];
  const normalizedTopic = topic.toLowerCase();
  const localizedTags = extractLocalizedTopicTags(magazineSlug, normalizedTopic);

  return [...new Set([
    ...knownTags.filter((tag) => normalizedTopic.includes(tag)),
    ...localizedTags
  ])];
}

function extractLocalizedTopicTags(magazineSlug: string, normalizedTopic: string): string[] {
  const translations = magazineSlug === 'dog'
    ? [
        ['산책', 'walk'],
        ['냄새', 'sniff'],
        ['훈련', 'training'],
        ['간식', 'treat'],
        ['놀이', 'play'],
        ['건강', 'health'],
        ['미용', 'grooming']
      ]
    : [
        ['수면', 'sleep'],
        ['사료', 'food'],
        ['놀이', 'play'],
        ['장난감', 'toy'],
        ['건강', 'health'],
        ['실내', 'indoor']
      ];

  return translations
    .filter(([source]) => normalizedTopic.includes(source))
    .map(([, tag]) => tag);
}

function createAffiliateDisclosure(linkCount: number): string {
  return linkCount === 0
    ? 'Affiliate disclosure placeholder. No mock affiliate links were generated.'
    : 'Affiliate disclosure placeholder. Mock affiliate links are shown for dry-run review only.';
}

function createDryRunDestination(): PublishingDestination {
  return {
    type: 'preview',
    name: 'Dry Run Preview',
    enabled: false,
    dryRunOnly: true
  };
}
