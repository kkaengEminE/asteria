import type { PublishRequest, PublishResult, Publisher } from '../../domain/publisher/index.ts';

export class DryRunPublisher implements Publisher {
  readonly name: string;
  readonly mode = 'dry-run' as const;

  constructor(options: { name?: string } = {}) {
    this.name = options.name ?? 'dry-run-publisher';
  }

  async publish(request: PublishRequest): Promise<PublishResult> {
    const publishId = createDeterministicPublishId(request);

    return {
      status: 'PREVIEW',
      publisher: this.name,
      mode: 'preview',
      destination: request.destination,
      publishId,
      previewUrl: createPreviewUrl(request, publishId),
      message: 'Dry-run publish preview generated. Publishing remains disabled.',
      metadata: {
        ...request.metadata,
        adapter: 'dry-run',
        dryRun: true,
        published: false,
        publishingEnabled: false,
        targetSite: 'preview.asteria.local'
      }
    };
  }
}

function createDeterministicPublishId(request: PublishRequest): string {
  const slug = request.publishingPackage.article.slug || slugify(request.publishingPackage.article.title);
  const destination = slugify(request.destination.name || request.destination.type);

  return `preview-${destination}-${slug}`;
}

function createPreviewUrl(request: PublishRequest, publishId: string): string {
  const destination = slugify(request.destination.type || 'publisher');

  return `https://preview.asteria.local/${destination}/${publishId}`;
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'publish';
}
