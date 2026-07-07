import type { ProviderContext } from './ProviderContext.ts';
import { normalizeProviderFactory, type ProviderFactory, type ProviderFactoryInput } from './ProviderFactory.ts';
import {
  providerTokenKey,
  type ProviderCategory,
  type ProviderToken
} from './ProviderToken.ts';

export interface ProviderRegistration<TProvider = unknown> {
  token: ProviderToken<TProvider>;
  factory: ProviderFactory<TProvider>;
}

export interface ProviderDescriptor {
  category: ProviderCategory;
  name: string;
  description?: string;
}

export class DuplicateProviderRegistrationError extends Error {
  constructor(token: ProviderToken<unknown>) {
    super(`Provider already registered: ${providerTokenKey(token)}`);
    this.name = 'DuplicateProviderRegistrationError';
  }
}

export class ProviderNotFoundError extends Error {
  constructor(token: ProviderToken<unknown>) {
    super(`Provider not found: ${providerTokenKey(token)}`);
    this.name = 'ProviderNotFoundError';
  }
}

export class ProviderRegistry {
  private readonly registrations = new Map<string, ProviderRegistration<unknown>>();

  register<TProvider>(token: ProviderToken<TProvider>, factory: ProviderFactoryInput<TProvider>): void {
    const key = providerTokenKey(token);

    if (this.registrations.has(key)) {
      throw new DuplicateProviderRegistrationError(token);
    }

    this.registrations.set(key, {
      token,
      factory: normalizeProviderFactory(factory) as ProviderFactory<unknown>
    });
  }

  async resolve<TProvider>(token: ProviderToken<TProvider>, context: ProviderContext): Promise<TProvider> {
    const registration = this.registrations.get(providerTokenKey(token));

    if (!registration) {
      throw new ProviderNotFoundError(token);
    }

    return (await registration.factory.create(context)) as TProvider;
  }

  has(token: ProviderToken<unknown>): boolean {
    return this.registrations.has(providerTokenKey(token));
  }

  remove(token: ProviderToken<unknown>): boolean {
    return this.registrations.delete(providerTokenKey(token));
  }

  list(category?: ProviderCategory): ProviderDescriptor[] {
    return [...this.registrations.values()]
      .filter((registration) => !category || registration.token.category === category)
      .map((registration) => ({
        category: registration.token.category,
        name: registration.token.name,
        description: registration.token.description
      }))
      .sort((left, right) => `${left.category}:${left.name}`.localeCompare(`${right.category}:${right.name}`));
  }
}

