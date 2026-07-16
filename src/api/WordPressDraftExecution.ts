import type { PublishResult } from '../domain/publisher/index.ts';
import { WordPressPublisher, createWordPressPublisherConfigFromEnv } from '../providers/publisher/wordpress/index.ts';
import { PublisherService } from '../services/publisher/index.ts';
import { createWordPressDraftPublishingPackage, type WordPressDraftApiRequest } from './WordPressDraftApiRequest.ts';

export interface WordPressDraftApiResult {
  state: 'saved';
  draftId: string;
  editUrl?: string;
  destinationSite: string;
  savedAt: string;
  clientRequestId: string;
}

export class WordPressDraftExecutionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'WordPressDraftExecutionError';
    this.code = code;
  }
}

export async function executeWordPressDraft(
  request: WordPressDraftApiRequest,
  env: NodeJS.ProcessEnv = process.env
): Promise<WordPressDraftApiResult> {
  if (env.WORDPRESS_ENABLED !== 'true' || env.ASTERIA_WORDPRESS_DRAFT_ENABLED !== 'true') {
    throw new WordPressDraftExecutionError(
      'wordpress_draft_disabled',
      'WordPress draft saving is disabled. Enable WORDPRESS_ENABLED and ASTERIA_WORDPRESS_DRAFT_ENABLED.'
    );
  }

  try {
    const config = createWordPressPublisherConfigFromEnv(env);
    const publisher = new WordPressPublisher(config as ConstructorParameters<typeof WordPressPublisher>[0]);
    const service = new PublisherService({ publisher, publishingEnabled: true });
    const result = await service.publish({
      publishingPackage: createWordPressDraftPublishingPackage(request),
      destination: {
        type: 'wordpress',
        name: config.siteLabel ?? 'Configured WordPress site',
        enabled: true,
        dryRunOnly: false
      },
      mode: 'production',
      requestedAt: new Date().toISOString(),
      metadata: { clientRequestId: request.clientRequestId, draftOnly: true }
    });
    return mapDraftResult(result, request.clientRequestId);
  } catch (error) {
    if (error instanceof WordPressDraftExecutionError) throw error;
    throw new WordPressDraftExecutionError('wordpress_draft_failed', redactWordPressError(error));
  }
}

function mapDraftResult(result: PublishResult, clientRequestId: string): WordPressDraftApiResult {
  if (result.status === 'FAILED' || result.status === 'SKIPPED' || !result.publishId) {
    throw new WordPressDraftExecutionError(
      result.failure?.code ?? 'wordpress_draft_failed',
      redactWordPressError(result.failure?.reason ?? result.message)
    );
  }
  return {
    state: 'saved',
    draftId: String(result.metadata?.wordpressPostId ?? result.publishId),
    editUrl: result.previewUrl,
    destinationSite: result.destination.name,
    savedAt: new Date().toISOString(),
    clientRequestId
  };
}

export function redactWordPressError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]')
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [redacted]')
    .replace(/(password|authorization|credential|username)\s*[:=]\s*[^\s,]+/gi, '$1=[redacted]');
}
