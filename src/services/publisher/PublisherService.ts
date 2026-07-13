import type { AuditLog } from '../auditLog/index.ts';
import { RetryService } from '../retry/index.ts';
import type { PublishFailure, PublishRequest, PublishResult, Publisher } from '../../domain/publisher/index.ts';
import type { RetryPolicy } from '../../domain/retry/index.ts';
import type { MetricsService } from '../metrics/index.ts';

export interface PublisherServiceOptions {
  publisher: Publisher;
  publishingEnabled?: boolean;
  retryService?: RetryService;
  retryPolicy?: Partial<RetryPolicy>;
  auditLog?: AuditLog;
  metricsService?: MetricsService;
}

export class PublisherService {
  private readonly publisher: Publisher;
  private readonly publishingEnabled: boolean;
  private readonly retryService: RetryService;
  private readonly retryPolicy?: Partial<RetryPolicy>;
  private readonly auditLog?: AuditLog;
  private readonly metricsService?: MetricsService;

  constructor(options: PublisherServiceOptions) {
    this.publisher = options.publisher;
    this.publishingEnabled = options.publishingEnabled === true;
    this.retryService = options.retryService ?? new RetryService();
    this.retryPolicy = options.retryPolicy;
    this.auditLog = options.auditLog;
    this.metricsService = options.metricsService;
  }

  async publish(request: PublishRequest): Promise<PublishResult> {
    const startedAt = Date.now();
    const validationFailure = validatePublishRequest(request);
    const mode = this.publishingEnabled ? request.mode ?? 'preview' : 'preview';
    const normalizedRequest: PublishRequest = {
      ...request,
      mode
    };

    if (validationFailure) {
      return this.skip(normalizedRequest, validationFailure);
    }

    if (!this.publishingEnabled && this.publisher.mode !== 'dry-run') {
      return this.skip(normalizedRequest, {
        code: 'publishing_disabled',
        reason: 'Publishing is disabled. Only DryRunPublisher may execute preview mode.',
        retryable: false
      });
    }

    this.auditLog?.append({
      type: 'PUBLISH_STARTED',
      actor: createPublisherActor(this.publisher.name),
      context: createPublishAuditContext(normalizedRequest),
      message: `Publish ${mode} started with ${this.publisher.name}.`,
      metadata: {
        publisher: this.publisher.name,
        mode
      }
    });
    this.metricsService?.incrementCounter('publisher.started', 1, {
      tags: {
        publisher: this.publisher.name,
        mode
      }
    });

    const retryResult = await this.retryService.execute(
      async () => {
        const result = normalizePublishResult(await this.publisher.publish(normalizedRequest), this.publisher.name, normalizedRequest);

        if (result.status === 'FAILED' && result.failure?.retryable) {
          throw createRetryablePublishError(result.failure);
        }

        return result;
      },
      {
        policy: this.retryPolicy
      }
    );

    if (retryResult.status === 'success') {
      const result = {
        ...retryResult.value!,
        metadata: {
          ...retryResult.value!.metadata,
          attemptCount: retryResult.attemptCount,
          retryCount: retryResult.retryCount
        }
      };

      this.auditLog?.append({
        type: 'PUBLISH_SUCCEEDED',
        actor: createPublisherActor(this.publisher.name),
        context: createPublishAuditContext(normalizedRequest),
        message: result.message,
        metadata: {
          publisher: this.publisher.name,
          mode: result.mode,
          publishId: result.publishId,
          previewUrl: result.previewUrl,
          retryCount: retryResult.retryCount
        }
      });
      this.metricsService?.incrementCounter('publisher.succeeded', 1, {
        tags: {
          publisher: this.publisher.name,
          status: result.status
        }
      });
      this.metricsService?.recordDuration('publisher.duration_ms', Date.now() - startedAt, {
        tags: {
          publisher: this.publisher.name
        }
      });

      return result;
    }

    const failure: PublishFailure = {
      code: retryResult.finalReason?.code ?? 'publish_failed',
      reason: retryResult.finalReason?.message ?? 'Publisher execution failed.',
      retryable: retryResult.finalReason?.retryable
    };
    const failed = createFailedPublishResult(normalizedRequest, this.publisher.name, failure, {
      attemptCount: retryResult.attemptCount,
      retryCount: retryResult.retryCount
    });

    this.auditLog?.append({
      type: 'PUBLISH_FAILED',
      actor: createPublisherActor(this.publisher.name),
      context: createPublishAuditContext(normalizedRequest),
      message: failure.reason,
      metadata: {
        publisher: this.publisher.name,
        failureCode: failure.code,
        retryCount: retryResult.retryCount
      }
    });
    this.metricsService?.recordFailure('publisher.failed', failure.reason, {
      tags: {
        publisher: this.publisher.name,
        code: failure.code
      }
    });

    return failed;
  }

  private skip(request: PublishRequest, failure: PublishFailure): PublishResult {
    const result: PublishResult = {
      status: 'SKIPPED',
      publisher: this.publisher.name,
      mode: request.mode ?? 'preview',
      destination: request.destination,
      failure,
      message: failure.reason,
      metadata: {
        ...request.metadata,
        published: false
      }
    };

    this.auditLog?.append({
      type: 'PUBLISH_SKIPPED',
      actor: createPublisherActor(this.publisher.name),
      context: createPublishAuditContext(request),
      message: failure.reason,
      metadata: {
        publisher: this.publisher.name,
        failureCode: failure.code
      }
    });
    this.metricsService?.incrementCounter('publisher.skipped', 1, {
      tags: {
        publisher: this.publisher.name,
        code: failure.code
      }
    });

    return result;
  }
}

function validatePublishRequest(request: PublishRequest): PublishFailure | undefined {
  if (!request.publishingPackage?.article?.title?.trim()) {
    return {
      code: 'missing_title',
      reason: 'PublishRequest requires article title.',
      retryable: false
    };
  }

  if (!request.publishingPackage?.article?.body?.trim()) {
    return {
      code: 'missing_body',
      reason: 'PublishRequest requires article body.',
      retryable: false
    };
  }

  if (!request.destination?.name?.trim()) {
    return {
      code: 'missing_destination',
      reason: 'PublishRequest requires destination name.',
      retryable: false
    };
  }

  return undefined;
}

function normalizePublishResult(result: PublishResult, publisher: string, request: PublishRequest): PublishResult {
  return {
    ...result,
    publisher: result.publisher || publisher,
    mode: result.mode ?? request.mode ?? 'preview',
    destination: result.destination ?? request.destination,
    message: result.message || 'Publisher execution completed.'
  };
}

function createFailedPublishResult(
  request: PublishRequest,
  publisher: string,
  failure: PublishFailure,
  metadata: Record<string, unknown>
): PublishResult {
  return {
    status: 'FAILED',
    publisher,
    mode: request.mode ?? 'preview',
    destination: request.destination,
    failure,
    message: failure.reason,
    metadata: {
      ...request.metadata,
      ...metadata,
      published: false
    }
  };
}

function createRetryablePublishError(failure: PublishFailure): Error {
  const error = new Error(failure.reason) as Error & { code: string; retryable: boolean };
  error.code = failure.code;
  error.retryable = failure.retryable === true;

  return error;
}

function createPublisherActor(publisher: string) {
  return {
    type: 'service' as const,
    id: `publisher-service:${publisher}`,
    name: 'PublisherService'
  };
}

function createPublishAuditContext(request: PublishRequest) {
  return {
    entityId: request.publishingPackage.article.slug || request.publishingPackage.article.title,
    entityType: 'publishingPackage',
    metadata: {
      destination: request.destination.name,
      mode: request.mode ?? 'preview'
    }
  };
}
