export interface WordPressPublisherConfig {
  siteUrl: string;
  defaultStatus?: 'draft' | 'pending' | 'private';
  dryRun?: boolean;
  enabled?: boolean;
  username?: string;
  applicationPassword?: string;
  transport?: import('./WordPressTransport.ts').WordPressTransport;
  retryService?: import('../../../services/retry/index.ts').RetryService;
  auditLog?: import('../../../services/auditLog/index.ts').AuditLog;
}

export class WordPressPublisherConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordPressPublisherConfigError';
  }
}

export function validateWordPressPublisherConfig(config: WordPressPublisherConfig): void {
  if (!config.siteUrl || config.siteUrl.trim().length === 0) {
    throw new WordPressPublisherConfigError('WordPress publisher config requires siteUrl.');
  }

  if (config.dryRun === false && config.enabled !== true) {
    throw new WordPressPublisherConfigError(
      'WordPress publishing is disabled. Set WORDPRESS_ENABLED=true before executing the WordPress adapter.'
    );
  }

  if (config.dryRun === false) {
    const missing = [
      ['WORDPRESS_USERNAME', config.username],
      ['WORDPRESS_APPLICATION_PASSWORD', config.applicationPassword]
    ]
      .filter(([, value]) => typeof value !== 'string' || value.trim().length === 0)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new WordPressPublisherConfigError(`WordPress credentials are missing: ${missing.join(', ')}.`);
    }
  }
}

export interface WordPressEnvironment {
  WORDPRESS_ENABLED?: string;
  WORDPRESS_SITE_URL?: string;
  WORDPRESS_USERNAME?: string;
  WORDPRESS_APPLICATION_PASSWORD?: string;
}

export function createWordPressPublisherConfigFromEnv(
  env: WordPressEnvironment = process.env
): Partial<WordPressPublisherConfig> {
  return {
    dryRun: false,
    enabled: env.WORDPRESS_ENABLED === 'true',
    siteUrl: env.WORDPRESS_SITE_URL ?? '',
    username: env.WORDPRESS_USERNAME,
    applicationPassword: env.WORDPRESS_APPLICATION_PASSWORD
  };
}
