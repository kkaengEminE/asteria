import type { PublishRequest, PublishResult } from '../../../domain/publisher/index.ts';
import { createWordPressPostPayload, type WordPressPostPayload } from './WordPressPostPayload.ts';
import type { WordPressTransportPostResponse } from './WordPressTransport.ts';

export function mapPublishRequestToWordPressPostPayload(
  request: PublishRequest,
  _defaultStatus: WordPressPostPayload['status'] = 'draft'
): WordPressPostPayload {
  const category = request.publishingPackage.article.metadata.category;

  return createWordPressPostPayload({
    draft: {
      title: request.publishingPackage.article.title,
      slug: request.publishingPackage.article.slug,
      summary: request.publishingPackage.summary.text,
      body: request.publishingPackage.article.body,
      format: 'article',
      language: request.publishingPackage.article.language,
      categories: category ? [category.name] : readStringArray(request.publishingPackage.metadata?.wordpressCategories),
      tags: request.publishingPackage.article.metadata.tags.map((tag) => tag.name),
      featuredMediaId: readFeaturedMediaId(request),
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
  }, 'draft');
}

function readFeaturedMediaId(request: PublishRequest): number | undefined {
  const value = request.metadata?.wordpressFeaturedMediaId ?? request.publishingPackage.metadata?.wordpressFeaturedMediaId;
  return typeof value === 'number' ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;
}

export function mapWordPressResponseToPublishResult(input: {
  request: PublishRequest;
  post: WordPressPostPayload;
  response: WordPressTransportPostResponse;
  publisher: string;
  siteUrl: string;
  publishingEnabled: boolean;
}): PublishResult {
  const publishId = `wordpress-draft-${String(input.response.id)}`;
  const editUrl = `${input.siteUrl.replace(/\/+$/, '')}/wp-admin/post.php?post=${encodeURIComponent(String(input.response.id))}&action=edit`;

  return {
    status: 'PREVIEW',
    publisher: input.publisher,
    mode: 'preview',
    destination: input.request.destination,
    publishId,
    previewUrl: editUrl,
    message: `WordPress draft created for "${input.post.title}". The post was not published.`,
    metadata: {
      ...input.request.metadata,
      provider: 'wordpress',
      adapter: 'wordpress',
      dryRun: false,
      published: false,
      publishingEnabled: input.publishingEnabled,
      targetSite: input.siteUrl,
      post: input.post,
      wordpressStatus: input.response.status,
      wordpressPostId: String(input.response.id)
    }
  };
}
