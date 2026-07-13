import type { ApprovalResult } from '../../domain/approval/index.ts';
import type { PublishingPackage } from '../../domain/content/index.ts';
import type { PublishingDestination, PublishingQueueResult } from '../../domain/publishingQueue/index.ts';
import type { PublishRequest, PublishResult, Publisher } from '../../domain/publisher/index.ts';
import { PublisherService } from '../publisher/index.ts';
import type { PublishingQueue } from '../publishingQueue/index.ts';
import { createPublishingWorkflowConfig, type PublishingWorkflowConfig } from './PublishingWorkflowConfig.ts';

export interface PublishingWorkflowOptions {
  publisher?: Publisher;
  publisherService?: PublisherService;
  config?: Partial<PublishingWorkflowConfig>;
  queue?: PublishingQueue;
}

export interface PublishingWorkflowInput {
  publishingPackage: PublishingPackage;
  approvalResult?: ApprovalResult;
  destination: PublishingDestination;
  metadata?: Record<string, unknown>;
}

export class PublishingWorkflow {
  private readonly publisher?: Publisher;
  private readonly publisherService: PublisherService;
  private readonly config: PublishingWorkflowConfig;
  private readonly queue?: PublishingQueue;

  constructor(options: PublishingWorkflowOptions) {
    if (!options.publisher && !options.publisherService) {
      throw new Error('PublishingWorkflow requires a Publisher or PublisherService.');
    }

    this.publisher = options.publisher;
    this.config = createPublishingWorkflowConfig(options.config);
    this.publisherService =
      options.publisherService ??
      new PublisherService({
        publisher: options.publisher!,
        publishingEnabled: this.config.publishingEnabled
      });
    this.queue = options.queue;
  }

  async execute(input: PublishingWorkflowInput): Promise<PublishResult> {
    const approvalDecision = input.approvalResult?.decision;
    const providerName = this.publisher?.name ?? 'publisher-service';

    if (this.queue) {
      const queueResult = await this.queue.enqueue({
        publishingPackage: input.publishingPackage,
        approvalResult: input.approvalResult,
        destination: input.destination,
        metadata: {
          ...input.metadata,
          provider: providerName,
          dryRun: true
        }
      });

      return createQueuedPublishingResult(input.destination, queueResult, {
        provider: providerName
      });
    }

    if (this.config.requireApproval && approvalDecision !== 'APPROVED') {
      return createSkippedPublishingResult(
        input.destination,
        `Publishing requires APPROVED content. Current decision: ${approvalDecision ?? 'UNKNOWN'}.`,
        {
          provider: providerName,
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
          provider: providerName,
          publishingEnabled: false,
          dryRun: false
        }
      );
    }

    const request = createPublishRequest(input, {
      mode: this.config.dryRun ? 'preview' : 'production'
    });

    return this.publisherService.publish(request);
  }
}

export function createPublishRequest(
  input: PublishingWorkflowInput,
  options: Pick<PublishRequest, 'mode'> = {}
): PublishRequest {
  return {
    publishingPackage: input.publishingPackage,
    destination: {
      ...input.destination,
      dryRunOnly: input.destination.dryRunOnly ?? true
    },
    mode: options.mode ?? 'preview',
    metadata: {
      ...input.metadata,
      approvalDecision: input.approvalResult?.decision,
      publishingPackageMetadata: input.publishingPackage.metadata
    }
  };
}

function createQueuedPublishingResult(
  destination: PublishingDestination,
  queueResult: PublishingQueueResult,
  metadata: Record<string, unknown>
): PublishResult {
  const queued = queueResult.status === 'queued';

  return {
    status: queued ? 'PREVIEW' : 'SKIPPED',
    publisher: String(metadata.provider ?? 'publisher-service'),
    mode: 'preview',
    destination,
    publishId: queueResult.item?.id,
    failure: queued
      ? undefined
      : {
          code: queueResult.failure?.code ?? 'queue_rejected',
          reason: queueResult.failure?.reason ?? queueResult.message,
          retryable: false
        },
    message: queueResult.message,
    metadata: {
      ...metadata,
      dryRun: true,
      published: false,
      queued,
      queueResult
    }
  };
}

function createSkippedPublishingResult(
  destination: PublishingDestination,
  message: string,
  metadata: Record<string, unknown>
): PublishResult {
  return {
    status: 'SKIPPED',
    publisher: String(metadata.provider ?? 'publisher-service'),
    mode: metadata.dryRun === false ? 'production' : 'preview',
    destination,
    failure: {
      code: 'publishing_skipped',
      reason: message,
      retryable: false
    },
    message,
    metadata: {
      ...metadata,
      dryRun: true,
      published: false
    }
  };
}
