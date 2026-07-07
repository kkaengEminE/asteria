export type ProviderCategory =
  | 'AI'
  | 'Research'
  | 'Publisher'
  | 'Image'
  | 'Affiliate'
  | 'TTS'
  | 'Podcast'
  | 'Analytics';

export interface ProviderToken<TProvider = unknown> {
  readonly category: ProviderCategory;
  readonly name: string;
  readonly description?: string;
  readonly __type?: TProvider;
}

export function createProviderToken<TProvider>(
  category: ProviderCategory,
  name: string,
  description?: string
): ProviderToken<TProvider> {
  return {
    category,
    name,
    description
  };
}

export function providerTokenKey(token: ProviderToken<unknown>): string {
  return `${token.category}:${token.name}`;
}

