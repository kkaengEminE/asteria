import { loadMagazineConfig } from '../../config/index.ts';
import type { MagazineConfig } from '../../core/MagazineConfig.ts';
import type { AIProvider, Publisher, ResearchProvider } from '../../core/index.ts';
import type { ContentDraft, PublishingDestination, ResearchResult } from '../../core/types.ts';
import { PromptManager } from '../../prompts/index.ts';
import type { WorkflowContext, WorkflowStep, WorkflowStepResult } from '../../workflows/index.ts';

export interface CatDryRunStepOptions {
  topic: string;
  rootDir?: string;
  promptKey?: string;
  researchProvider: ResearchProvider;
  aiProvider: AIProvider;
  publisher: Publisher;
}

export function createCatDryRunSteps(options: CatDryRunStepOptions): WorkflowStep[] {
  return [
    createLoadConfigStep(options),
    createLoadPromptStep(options),
    createResearchStep(options),
    createGenerateArticleStep(options),
    createGenerateSeoStep(options),
    createPublishPreviewStep(options)
  ];
}

function createLoadConfigStep(options: CatDryRunStepOptions): WorkflowStep {
  return {
    name: 'Load Config',
    async execute(context): Promise<WorkflowStepResult> {
      const magazineConfig = await loadMagazineConfig('cat', { rootDir: options.rootDir });

      return success('Load Config', {
        ...context,
        magazineSlug: magazineConfig.slug,
        data: {
          ...context.data,
          magazineConfig
        }
      });
    }
  };
}

function createLoadPromptStep(options: CatDryRunStepOptions): WorkflowStep {
  return {
    name: 'Load Prompt',
    async execute(context): Promise<WorkflowStepResult> {
      const magazineConfig = requireData<MagazineConfig>(context, 'magazineConfig');
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

      return success('Load Prompt', {
        ...context,
        data: {
          ...context.data,
          articlePrompt,
          seoPrompt
        }
      });
    }
  };
}

function createResearchStep(options: CatDryRunStepOptions): WorkflowStep {
  return {
    name: 'Research',
    async execute(context): Promise<WorkflowStepResult> {
      const researchResults = await options.researchProvider.search({
        topic: options.topic,
        language: 'en-US'
      });

      return success('Research', {
        ...context,
        data: {
          ...context.data,
          researchResults
        }
      });
    }
  };
}

function createGenerateArticleStep(options: CatDryRunStepOptions): WorkflowStep {
  return {
    name: 'Generate Article',
    async execute(context): Promise<WorkflowStepResult> {
      const articlePrompt = requireData<string>(context, 'articlePrompt');
      const response = await options.aiProvider.generate({ prompt: articlePrompt });

      return success('Generate Article', {
        ...context,
        data: {
          ...context.data,
          generatedArticle: response.text
        }
      });
    }
  };
}

function createGenerateSeoStep(options: CatDryRunStepOptions): WorkflowStep {
  return {
    name: 'Generate SEO',
    async execute(context): Promise<WorkflowStepResult> {
      const seoPrompt = requireData<string>(context, 'seoPrompt');
      const response = await options.aiProvider.generate({ prompt: seoPrompt });

      return success('Generate SEO', {
        ...context,
        data: {
          ...context.data,
          seoPreview: response.text
        }
      });
    }
  };
}

function createPublishPreviewStep(options: CatDryRunStepOptions): WorkflowStep {
  return {
    name: 'Publish Preview',
    async execute(context): Promise<WorkflowStepResult> {
      const magazineConfig = requireData<MagazineConfig>(context, 'magazineConfig');
      const generatedArticle = requireData<string>(context, 'generatedArticle');
      const destination = magazineConfig.publishingDestinations[0] ?? createDryRunDestination();
      const publishPreview = await options.publisher.publish({
        draft: createContentDraft(generatedArticle, magazineConfig.language),
        destination
      });

      return success('Publish Preview', {
        ...context,
        data: {
          ...context.data,
          publishPreview
        }
      });
    }
  };
}

function success(stepName: string, context: WorkflowContext): WorkflowStepResult {
  return {
    stepName,
    status: 'success',
    context
  };
}

function requireData<TValue>(context: WorkflowContext, key: string): TValue {
  const value = context.data[key];

  if (value === undefined) {
    throw new Error(`Missing workflow data: ${key}`);
  }

  return value as TValue;
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

function createDryRunDestination(): PublishingDestination {
  return {
    type: 'preview',
    name: 'Dry Run Preview',
    enabled: false,
    dryRunOnly: true
  };
}

export function getResearchResults(context: WorkflowContext): ResearchResult[] | undefined {
  return context.data.researchResults as ResearchResult[] | undefined;
}
