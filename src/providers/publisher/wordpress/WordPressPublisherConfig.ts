export interface WordPressPublisherConfig {
  siteUrl: string;
  defaultStatus?: 'draft' | 'pending' | 'private';
  dryRun: true;
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

  if (config.dryRun !== true) {
    throw new WordPressPublisherConfigError('WordPress publisher draft only supports dryRun: true.');
  }
}

