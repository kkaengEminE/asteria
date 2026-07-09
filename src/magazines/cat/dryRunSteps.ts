import { loadMagazineConfig } from '../../config/index.ts';
import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { Publisher, ResearchProvider } from '../../core/index.ts';
import type { PublishingDestination } from '../../core/types.ts';
import type { ApprovalResult } from '../../domain/approval/index.ts';
import type { PublishingPackage } from '../../domain/content/index.ts';
import type { ImageDomainLibrary, ImageSelectionCriteria } from '../../domain/image/index.ts';
import type { MonetizationProvider, ProductSearchQuery } from '../../domain/monetization/index.ts';
import type { AIProvider } from '../../providers/ai/index.ts';
import { PromptManager } from '../../prompts/index.ts';
import { DryRunStepFactory, requireWorkflowData } from '../../services/dryRun/index.ts';
import { PublishingWorkflow } from '../../services/publishing/index.ts';
import { ContentGenerationWorkflow } from '../../workflows/contentGeneration/index.ts';
import type { WorkflowStep } from '../../workflows/index.ts';

export interface CatDryRunStepOptions {
  topic: string;
  language?: string;
  rootDir?: string;
  promptKey?: string;
  researchProvider: ResearchProvider;
  aiProvider: AIProvider;
  publisher: Publisher;
  imageLibrary: ImageDomainLibrary;
  monetizationProvider: MonetizationProvider;
}

export function createCatDryRunSteps(options: CatDryRunStepOptions): WorkflowStep[] {
  const stepFactory = new DryRunStepFactory();

  return [
    createLoadConfigStep(stepFactory, options),
    createLoadPromptStep(stepFactory, options),
    createResearchStep(stepFactory, options),
    createGeneratePublishingPackageStep(stepFactory, options),
    createSelectImageStep(stepFactory, options),
    createGenerateArticleStep(stepFactory, options),
    createGenerateSeoStep(stepFactory, options),
    createGenerateMonetizationPreviewStep(stepFactory, options),
    createPublishPreviewStep(stepFactory, options)
  ];
}

function createGeneratePublishingPackageStep(
  stepFactory: DryRunStepFactory,
  options: CatDryRunStepOptions
): WorkflowStep {
  return stepFactory.createStep({
    name: 'Generate Publishing Package',
    async execute(context) {
      const magazineConfig = requireWorkflowData<MagazineConfig>(context, 'magazineConfig');
      const language = options.language ?? magazineConfig.language;
      const workflow = new ContentGenerationWorkflow({
        aiProvider: options.aiProvider
      });
      const publishingPackage = await workflow.execute({
        topic: options.topic,
        language,
        audience: magazineConfig.audience,
        tone: magazineConfig.tone,
        magazineName: magazineConfig.name,
        createdAt: '2026-07-08T00:00:00.000Z',
        metadata: {
          dryRun: true,
          magazineSlug: magazineConfig.slug
        }
      });

      return {
        ...context,
        data: {
          ...context.data,
          publishingPackage,
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

function createSelectImageStep(stepFactory: DryRunStepFactory, options: CatDryRunStepOptions): WorkflowStep {
  return stepFactory.createStep({
    name: 'Select Image',
    async execute(context) {
      const criteria = createCatImageSelectionCriteria(options.topic);
      const candidates = await options.imageLibrary.search({
        text: 'cat',
        criteria: {
          tags: criteria.tags,
          minimumRating: criteria.minimumRating
        }
      });
      const selectedImage = await options.imageLibrary.select(candidates, criteria);

      if (!selectedImage) {
        throw new Error('No image matched Cat Magazine dry-run criteria.');
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

function createLoadConfigStep(stepFactory: DryRunStepFactory, options: CatDryRunStepOptions): WorkflowStep {
  return stepFactory.createStep({
    name: 'Load Config',
    async execute(context) {
      const magazineConfig = await loadMagazineConfig('cat', { rootDir: options.rootDir });

      return {
        ...context,
        magazineSlug: magazineConfig.slug,
        data: {
          ...context.data,
          magazineConfig
        }
      };
    }
  });
}

function createLoadPromptStep(stepFactory: DryRunStepFactory, options: CatDryRunStepOptions): WorkflowStep {
  return stepFactory.createStep({
    name: 'Load Prompt',
    async execute(context) {
      const magazineConfig = requireWorkflowData<MagazineConfig>(context, 'magazineConfig');
      const promptManager = new PromptManager();

      await promptManager.load({ magazineSlug: magazineConfig.slug });

      const articlePrompt = promptManager.render(options.promptKey ?? 'article', {
        magazineName: magazineConfig.name,
        audience: magazineConfig.audience,
        tone: magazineConfig.tone,
        topic: options.topic
      });
      const seoPrompt = promptManager.render('seo', {
        magazineName: magazineConfig.name,
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

function createResearchStep(stepFactory: DryRunStepFactory, options: CatDryRunStepOptions): WorkflowStep {
  return stepFactory.createStep({
    name: 'Research',
    async execute(context) {
      const researchResults = await options.researchProvider.search({
        topic: options.topic,
        language: options.language ?? 'en-US'
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

function createGenerateArticleStep(stepFactory: DryRunStepFactory, options: CatDryRunStepOptions): WorkflowStep {
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

function createGenerateSeoStep(stepFactory: DryRunStepFactory, options: CatDryRunStepOptions): WorkflowStep {
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
  options: CatDryRunStepOptions
): WorkflowStep {
  return stepFactory.createStep({
    name: 'Generate Monetization Preview',
    async execute(context) {
      const query = createCatProductSearchQuery(options.topic);
      const recommendations = await options.monetizationProvider.recommendProducts(query);
      const monetizationResult = await options.monetizationProvider.previewRecommendation(options.topic, recommendations);
      const affiliateLinks = recommendations
        .map((recommendation) => recommendation.affiliateLink)
        .filter((link): link is NonNullable<typeof link> => Boolean(link));

      for (const link of affiliateLinks) {
        if (!link.url.startsWith('mock://')) {
          throw new Error('Cat Magazine dry run only allows mock affiliate links.');
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

function createPublishPreviewStep(stepFactory: DryRunStepFactory, options: CatDryRunStepOptions): WorkflowStep {
  return stepFactory.createStep({
    name: 'Publish Preview',
    async execute(context) {
      const magazineConfig = requireWorkflowData<MagazineConfig>(context, 'magazineConfig');
      const publishingPackage = requireWorkflowData<PublishingPackage>(context, 'publishingPackage');
      const destination = magazineConfig.publishingDestinations[0] ?? createDryRunDestination();
      const approvalResult = publishingPackage.metadata?.approvalResult as ApprovalResult | undefined;
      const publishingWorkflow = new PublishingWorkflow({
        publisher: options.publisher,
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
          publishPreview
        }
      };
    }
  });
}

function createCatImageSelectionCriteria(topic: string): ImageSelectionCriteria {
  const topicTags = extractCatTopicTags(topic);

  return {
    topic,
    tags: ['cat', ...topicTags],
    category: 'hero',
    aspectRatio: 'landscape',
    minimumRating: 4,
    randomWeight: 0.2
  };
}

function createCatProductSearchQuery(topic: string): ProductSearchQuery {
  const topicTags = extractCatTopicTags(topic);

  return {
    topic: topicTags[0] ?? 'cat',
    category: 'cat-care',
    tags: ['cat', ...topicTags],
    minimumRating: 4,
    limit: 3
  };
}

function extractCatTopicTags(topic: string): string[] {
  const knownTags = [
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

  return knownTags.filter((tag) => normalizedTopic.includes(tag));
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
