import type { PublishRequest, PublishResult } from '../../../domain/publisher/index.ts';
import { createWordPressPostPayload, type WordPressPostPayload } from './WordPressPostPayload.ts';
import type { WordPressTransportPostResponse } from './WordPressTransport.ts';

export function mapPublishRequestToWordPressPostPayload(
  request: PublishRequest,
  defaultStatus: WordPressPostPayload['status'] = 'draft'
): WordPressPostPayload {
  return createWordPressPostPayload({
    draft: {
      title: request.publishingPackage.article.title,
      slug: request.publishingPackage.article.slug,
      summary: request.publishingPackage.summary.text,
      body: request.publishingPackage.article.body,
      format: 'article',
      language: request.publishingPackage.article.language,
      tags: request.publishingPackage.article.metadata.tags.map((tag) => tag.name),
      metadata: {
        seo: request.publishingPackage.seo,
        faq: request.publishingPackage.faq,
        imagePrompt: request.publishingPackage.imagePrompt,
        productPrompt: request.publishingPackage.productPrompt
      }
    },
    destination: request.destination,
    metadata: {
      ...request.metadata,
      publishingPackageMetadata: request.publishingPackage.metadata
    }
  }, defaultStatus);
}

export function mapWordPressResponseToPublishResult(input: {
  request: PublishRequest;
  post: WordPressPostPayload;
  response: WordPressTransportPostResponse;
  publisher: string;
  siteUrl: string;
  publishingEnabled: boolean;
}): PublishResult {
  const publishId = `wordpress-preview-${String(input.response.id)}`;

  return {
    status: 'PREVIEW',
    publisher: input.publisher,
    mode: 'preview',
    destination: input.request.destination,
    publishId,
    previewUrl: input.response.link ?? `${input.siteUrl.replace(/\/+$/, '')}/?p=${input.response.id}`,
    message: `WordPress adapter preview created for "${input.post.title}". Publishing remains disabled.`,
    metadata: {
      ...input.request.metadata,
      provider: 'wordpress',
      adapter: 'wordpress',
      dryRun: true,
      published: false,
      publishingEnabled: input.publishingEnabled,
      targetSite: input.siteUrl,
      post: input.post,
      wordpressStatus: input.response.status
    }
  };
}
