import type { PublishRequest, PublishResult, Publisher } from '../../../domain/publisher/index.ts';
import { RetryService } from '../../../services/retry/index.ts';
import { createProviderToken } from '../../ProviderToken.ts';
import {
  validateWordPressPublisherConfig,
  type WordPressPublisherConfig
} from './WordPressPublisherConfig.ts';
import {
  mapPublishRequestToWordPressPostPayload,
  mapWordPressResponseToPublishResult
} from './WordPressMapper.ts';
import {
  FetchWordPressTransport,
  WordPressDisabledTransport,
  WordPressTransportError,
  type WordPressTransport
} from './WordPressTransport.ts';

export const wordpressPublisherToken = createProviderToken<Publisher>(
  'Publisher',
  'wordpress',
  'WordPress publisher adapter.'
);

export class WordPressPublisher implements Publisher {
  readonly name = 'wordpress';
  readonly mode = 'production-capable' as const;
  private readonly config: WordPressPublisherConfig;
  private readonly transport: WordPressTransport;
  private readonly retryService: RetryService;

  constructor(config: WordPressPublisherConfig) {
    validateWordPressPublisherConfig(config);
    this.config = config;
    this.transport = config.transport ?? (config.enabled ? new FetchWordPressTransport() : new WordPressDisabledTransport());
    this.retryService = config.retryService ?? new RetryService();
  }

  async publish(request: PublishRequest): Promise<PublishResult> {
    return this.publishRequest(request);
  }

  private async publishRequest(request: PublishRequest): Promise<PublishResult> {
    if (this.config.enabled !== true) {
      return {
        status: 'FAILED',
        publisher: this.name,
        mode: 'preview',
        destination: request.destination,
        failure: {
          code: 'wordpress_disabled',
          reason: 'WordPress publisher is disabled. Set WORDPRESS_ENABLED=true before executing the WordPress adapter.',
          retryable: false
        },
        message: 'WordPress publisher is disabled. Set WORDPRESS_ENABLED=true before executing the WordPress adapter.',
        metadata: {
          ...request.metadata,
          provider: 'wordpress',
          adapter: 'wordpress',
          publishingEnabled: false,
          targetSite: this.config.siteUrl,
          published: false
        }
      };
    }

    const post = mapPublishRequestToWordPressPostPayload(request, 'draft');
    this.config.auditLog?.append({
      type: 'PUBLISH_STARTED',
      actor: createWordPressActor(),
      context: createWordPressAuditContext(request),
      message: `WordPress adapter preview started for "${post.title}".`,
      metadata: {
        adapter: 'wordpress',
        targetSite: this.config.siteUrl
      }
    });

    const retryResult = await this.retryService.execute(
      () =>
        this.transport.createPost({
          siteUrl: this.config.siteUrl,
          username: this.config.username!,
          applicationPassword: this.config.applicationPassword!,
          post
        }),
      {
        policy: {
          maxAttempts: 3,
          delayMs: 25
        }
      }
    );

    if (retryResult.status === 'success') {
      const result = mapWordPressResponseToPublishResult({
        request,
        post,
        response: retryResult.value!,
        publisher: this.name,
        siteUrl: this.config.siteUrl,
        publishingEnabled: this.config.enabled === true
      });

      this.config.auditLog?.append({
        type: 'PUBLISH_SUCCEEDED',
        actor: createWordPressActor(),
        context: createWordPressAuditContext(request),
        message: result.message,
        metadata: {
          adapter: 'wordpress',
          publishId: result.publishId,
          previewUrl: result.previewUrl,
          retryCount: retryResult.retryCount
        }
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          attemptCount: retryResult.attemptCount,
          retryCount: retryResult.retryCount
        }
      };
    }

    const message = retryResult.finalReason?.message ?? 'WordPress draft creation failed.';
    const transportError = retryResult.error instanceof WordPressTransportError ? retryResult.error : undefined;
    this.config.auditLog?.append({
      type: 'PUBLISH_FAILED',
      actor: createWordPressActor(),
      context: createWordPressAuditContext(request),
      message,
      metadata: {
        adapter: 'wordpress',
        failureCode: retryResult.finalReason?.code,
        retryCount: retryResult.retryCount,
        failureDetails: transportError?.details
      }
    });

    return {
      status: 'FAILED',
      publisher: this.name,
      mode: 'preview',
      destination: request.destination,
      failure: {
        code: retryResult.finalReason?.code ?? 'wordpress_publish_failed',
        reason: message,
        retryable: retryResult.finalReason?.retryable
      },
      message,
      metadata: {
        ...request.metadata,
        provider: 'wordpress',
        adapter: 'wordpress',
        publishingEnabled: this.config.enabled === true,
        targetSite: this.config.siteUrl,
        published: false,
        attemptCount: retryResult.attemptCount,
        retryCount: retryResult.retryCount,
        failureDetails: transportError?.details
      }
    };
  }
}

function createWordPressActor() {
  return {
    type: 'service' as const,
    id: 'wordpress',
    name: 'WordPressPublisher'
  };
}

function createWordPressAuditContext(request: PublishRequest) {
  return {
    entityId: request.publishingPackage.article.slug || request.publishingPackage.article.title,
    entityType: 'publishingPackage',
    metadata: {
      destination: request.destination.name,
      adapter: 'wordpress'
    }
  };
}
