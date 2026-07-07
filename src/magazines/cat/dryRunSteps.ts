import { loadMagazineConfig } from '../../config/index.ts';
import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { AIProvider, Publisher, ResearchProvider } from '../../core/index.ts';
import type { ContentDraft, PublishingDestination } from '../../core/types.ts';
import type { ImageDomainLibrary, ImageSelectionCriteria } from '../../domain/image/index.ts';
import { PromptManager } from '../../prompts/index.ts';
import { DryRunStepFactory, requireWorkflowData } from '../../services/dryRun/index.ts';
import type { WorkflowStep } from '../../workflows/index.ts';

export interface CatDryRunStepOptions {
  topic: string;
  rootDir?: string;
  promptKey?: string;
  researchProvider: ResearchProvider;
  aiProvider: AIProvider;
  publisher: Publisher;
  imageLibrary: ImageDomainLibrary;
}

export function createCatDryRunSteps(options: CatDryRunStepOptions): WorkflowStep[] {
  const stepFactory = new DryRunStepFactory();

  return [
    createLoadConfigStep(stepFactory, options),
    createLoadPromptStep(stepFactory, options),
    createResearchStep(stepFactory, options),
    createSelectImageStep(stepFactory, options),
    createGenerateArticleStep(stepFactory, options),
    createGenerateSeoStep(stepFactory, options),
    createPublishPreviewStep(stepFactory, options)
  ];
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
        language: 'en-US'
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
      const response = await options.aiProvider.generate({ prompt: articlePrompt });

      return {
        ...context,
        data: {
          ...context.data,
          articlePreview: response.text
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
      const response = await options.aiProvider.generate({ prompt: seoPrompt });

      return {
        ...context,
        data: {
          ...context.data,
          seoPreview: response.text
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
      const articlePreview = requireWorkflowData<string>(context, 'articlePreview');
      const destination = magazineConfig.publishingDestinations[0] ?? createDryRunDestination();
      const publishPreview = await options.publisher.publish({
        draft: createContentDraft(articlePreview, magazineConfig.language),
        destination
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

function createContentDraft(body: string, language: string): ContentDraft {
  return {
    title: 'Mock Cat Care Article',
    slug: 'mock-cat-care-article',
    summary: 'Dry-run preview article generated with mock providers.',
    body,
    format: 'article',
    language,
    tags: ['cat', 'dry-run']
  };
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

function extractCatTopicTags(topic: string): string[] {
  const knownTags = ['sleep', 'food', 'play', 'toy', 'cute', 'window', 'health', 'enrichment'];
  const normalizedTopic = topic.toLowerCase();

  return knownTags.filter((tag) => normalizedTopic.includes(tag));
}

function createDryRunDestination(): PublishingDestination {
  return {
    type: 'preview',
    name: 'Dry Run Preview',
    enabled: false,
    dryRunOnly: true
  };
}
