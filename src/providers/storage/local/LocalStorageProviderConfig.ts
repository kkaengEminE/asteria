export interface LocalStorageProviderConfig {
  rootDir: string;
  name?: string;
}

export class LocalStorageProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalStorageProviderConfigError';
  }
}

export function validateLocalStorageProviderConfig(config: LocalStorageProviderConfig): void {
  if (!config.rootDir || config.rootDir.trim().length === 0) {
    throw new LocalStorageProviderConfigError('LocalStorageProvider requires rootDir.');
  }
}
