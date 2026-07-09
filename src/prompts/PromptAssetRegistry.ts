import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PromptAsset } from './PromptAsset.ts';
import type { PromptDefinition, RenderedPrompt } from './PromptDefinition.ts';
import type { PromptId } from './PromptId.ts';
import type { PromptMetadata } from './PromptMetadata.ts';
import { PromptTemplate } from './PromptTemplate.ts';
import type { PromptVariables } from './PromptVariables.ts';
import type { PromptVersion } from './PromptVersion.ts';

export class PromptAssetNotFoundError extends Error {
  constructor(id: PromptId, version?: PromptVersion) {
    super(version ? `Prompt asset not found: ${id}@${version}` : `Prompt asset not found: ${id}`);
    this.name = 'PromptAssetNotFoundError';
  }
}

export interface PromptAssetRegistryOptions {
  rootDir?: string;
}

export class PromptAssetRegistry {
  private readonly assets = new Map<string, PromptAsset>();

  register(asset: PromptAsset): void {
    this.assets.set(createAssetKey(asset.id, asset.version), asset);
  }

  resolve(id: PromptId, version?: PromptVersion): PromptDefinition {
    const asset = version ? this.assets.get(createAssetKey(id, version)) : this.resolveLatestAsset(id);

    if (!asset) {
      throw new PromptAssetNotFoundError(id, version);
    }

    return createPromptDefinition(asset);
  }

  resolveLatest(id: PromptId): PromptDefinition {
    return this.resolve(id);
  }

  metadata(id: PromptId, version?: PromptVersion): PromptMetadata {
    return this.resolve(id, version).metadata;
  }

  list(): PromptMetadata[] {
    return [...this.assets.values()].map((asset) => createPromptDefinition(asset).metadata);
  }

  private resolveLatestAsset(id: PromptId): PromptAsset | undefined {
    return [...this.assets.values()]
      .filter((asset) => asset.id === id)
      .sort((left, right) => comparePromptVersions(right.version, left.version))[0];
  }
}

export async function createDefaultPromptAssetRegistry(
  options: PromptAssetRegistryOptions = {}
): Promise<PromptAssetRegistry> {
  const rootDir = options.rootDir ?? process.cwd();
  const registry = new PromptAssetRegistry();
  const assets: Array<Omit<PromptAsset, 'template' | 'source'> & { path: string }> = [
    {
      id: 'content.article',
      version: 'v1',
      description: 'Article section prompt.',
      path: 'prompts/assets/content/article.v1.md'
    },
    {
      id: 'content.summary',
      version: 'v1',
      description: 'Summary section prompt.',
      path: 'prompts/assets/content/summary.v1.md'
    },
    {
      id: 'content.seo',
      version: 'v1',
      description: 'SEO metadata prompt.',
      path: 'prompts/assets/content/seo.v1.md'
    },
    {
      id: 'content.faq',
      version: 'v1',
      description: 'FAQ prompt.',
      path: 'prompts/assets/content/faq.v1.md'
    },
    {
      id: 'content.imagePrompt',
      version: 'v1',
      description: 'Image search prompt.',
      path: 'prompts/assets/content/image-prompt.v1.md'
    },
    {
      id: 'content.productPrompt',
      version: 'v1',
      description: 'Product recommendation prompt.',
      path: 'prompts/assets/content/product-prompt.v1.md'
    },
    {
      id: 'content.system',
      version: 'v1',
      description: 'System prompt for content generation.',
      path: 'prompts/assets/content/system.v1.md'
    },
    {
      id: 'content.persona',
      version: 'v1',
      description: 'Editorial persona prompt.',
      path: 'prompts/assets/content/persona.v1.md'
    },
    {
      id: 'content.style.default',
      version: 'v1',
      description: 'Default style prompt.',
      path: 'prompts/assets/content/style-default.v1.md'
    },
    {
      id: 'content.style.blog',
      version: 'v1',
      description: 'Blog style prompt.',
      path: 'prompts/assets/content/style-blog.v1.md'
    },
    {
      id: 'content.style.magazine',
      version: 'v1',
      description: 'Magazine style prompt.',
      path: 'prompts/assets/content/style-magazine.v1.md'
    },
    {
      id: 'content.task',
      version: 'v1',
      description: 'Content package task prompt.',
      path: 'prompts/assets/content/task.v1.md'
    },
    {
      id: 'content.outputSchema',
      version: 'v1',
      description: 'Publishing package output schema prompt.',
      path: 'prompts/assets/content/output-schema.v1.md'
    }
  ];

  for (const asset of assets) {
    const source = join(rootDir, asset.path);
    registry.register({
      id: asset.id,
      version: asset.version,
      description: asset.description,
      source,
      template: await readFile(source, 'utf8')
    });
  }

  return registry;
}

export function createPromptDefinition(asset: PromptAsset): PromptDefinition {
  const template = new PromptTemplate({
    key: asset.id,
    content: asset.template,
    source: 'shared',
    path: asset.source
  });
  const metadata: PromptMetadata = {
    id: asset.id,
    version: asset.version,
    description: asset.description,
    source: asset.source,
    variables: template.getRequiredVariables()
  };

  return {
    asset,
    metadata,
    render(variables: PromptVariables): RenderedPrompt {
      return {
        id: asset.id,
        version: asset.version,
        rendered: template.render(variables),
        variables,
        metadata
      };
    }
  };
}

function createAssetKey(id: PromptId, version: PromptVersion): string {
  return `${id}@${version}`;
}

function comparePromptVersions(left: PromptVersion, right: PromptVersion): number {
  return parsePromptVersion(left) - parsePromptVersion(right);
}

function parsePromptVersion(version: PromptVersion): number {
  const match = String(version).match(/^v(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}
