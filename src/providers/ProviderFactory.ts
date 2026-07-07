import type { ProviderContext } from './ProviderContext.ts';

export interface ProviderFactory<TProvider = unknown> {
  create(context: ProviderContext): TProvider | Promise<TProvider>;
}

export type ProviderFactoryInput<TProvider> = ProviderFactory<TProvider> | (() => TProvider | Promise<TProvider>);

export function normalizeProviderFactory<TProvider>(
  factory: ProviderFactoryInput<TProvider>
): ProviderFactory<TProvider> {
  if (typeof factory === 'function') {
    return {
      create: factory
    };
  }

  return factory;
}

