export interface WordPressPublisherConfig {
  siteUrl: string;
  siteLabel?: string;
  defaultStatus?: 'draft';
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

  try {
    const siteUrl = new URL(config.siteUrl);
    if (!['http:', 'https:'].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) {
      throw new Error('invalid');
    }
  } catch {
    throw new WordPressPublisherConfigError('WordPress publisher config requires a safe HTTP(S) base URL.');
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
  WORDPRESS_BASE_URL?: string;
  WORDPRESS_SITE_URL?: string;
  WORDPRESS_SITE_LABEL?: string;
  WORDPRESS_USERNAME?: string;
  WORDPRESS_APPLICATION_PASSWORD?: string;
}

export function createWordPressPublisherConfigFromEnv(
  env: WordPressEnvironment = process.env
): Partial<WordPressPublisherConfig> {
  return {
    dryRun: false,
    enabled: env.WORDPRESS_ENABLED === 'true',
    siteUrl: env.WORDPRESS_BASE_URL ?? env.WORDPRESS_SITE_URL ?? '',
    siteLabel: env.WORDPRESS_SITE_LABEL ?? 'Configured WordPress site',
    username: env.WORDPRESS_USERNAME,
    applicationPassword: env.WORDPRESS_APPLICATION_PASSWORD
  };
}
