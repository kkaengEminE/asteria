import type { Publisher } from '../../core/index.ts';
import type {
  ContentDraft,
  PublishingDestination,
  PublishingPayload,
  PublishingResult
} from '../../core/types.ts';
import type { ApprovalResult } from '../../domain/approval/index.ts';
import type { PublishingPackage } from '../../domain/content/index.ts';
import { createPublishingWorkflowConfig, type PublishingWorkflowConfig } from './PublishingWorkflowConfig.ts';

export interface PublishingWorkflowOptions {
  publisher: Publisher;
  config?: Partial<PublishingWorkflowConfig>;
}

export interface PublishingWorkflowInput {
  publishingPackage: PublishingPackage;
  approvalResult?: ApprovalResult;
  destination: PublishingDestination;
  metadata?: Record<string, unknown>;
}

export class PublishingWorkflow {
  private readonly publisher: Publisher;
  private readonly config: PublishingWorkflowConfig;

  constructor(options: PublishingWorkflowOptions) {
    this.publisher = options.publisher;
    this.config = createPublishingWorkflowConfig(options.config);
  }

  async execute(input: PublishingWorkflowInput): Promise<PublishingResult> {
    const approvalDecision = input.approvalResult?.decision;

    if (this.config.requireApproval && approvalDecision !== 'APPROVED') {
      return createSkippedPublishingResult(
        input.destination,
        `Publishing requires APPROVED content. Current decision: ${approvalDecision ?? 'UNKNOWN'}.`,
        {
          provider: this.publisher.name,
          approvalDecision: approvalDecision ?? 'UNKNOWN',
          blockingIssues: input.approvalResult?.blockingIssues ?? []
        }
      );
    }

    if (!this.config.dryRun && !this.config.publishingEnabled) {
      return createSkippedPublishingResult(
        input.destination,
        'Publishing is disabled. Set ASTERIA_PUBLISHING_ENABLED=true before any real publish operation.',
        {
          provider: this.publisher.name,
          publishingEnabled: false,
          dryRun: false
        }
      );
    }

    const payload = createPublishingPayload(input);

    return this.publisher.publish(payload);
  }
}

export function createPublishingPayload(input: PublishingWorkflowInput): PublishingPayload {
  return {
    draft: createContentDraftFromPackage(input.publishingPackage),
    destination: {
      ...input.destination,
      dryRunOnly: input.destination.dryRunOnly ?? true
    },
    metadata: {
      ...input.metadata,
      approvalDecision: input.approvalResult?.decision,
      publishingPackageMetadata: input.publishingPackage.metadata
    }
  };
}

function createContentDraftFromPackage(pkg: PublishingPackage): ContentDraft {
  return {
    title: pkg.article.title,
    slug: pkg.article.slug,
    summary: pkg.summary.text,
    body: pkg.article.body,
    format: 'article',
    language: pkg.article.language,
    tags: pkg.article.metadata.tags.map((tag) => tag.name),
    metadata: {
      seo: pkg.seo,
      faq: pkg.faq,
      imagePrompt: pkg.imagePrompt,
      productPrompt: pkg.productPrompt
    }
  };
}

function createSkippedPublishingResult(
  destination: PublishingDestination,
  message: string,
  metadata: Record<string, unknown>
): PublishingResult {
  return {
    status: 'skipped',
    destination,
    message,
    metadata: {
      ...metadata,
      dryRun: true,
      published: false
    }
  };
}
