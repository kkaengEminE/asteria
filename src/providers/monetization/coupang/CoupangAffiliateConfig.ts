import type { CoupangProductRecord } from './CoupangProductRecord.ts';

export interface CoupangAffiliateConfig {
  name?: string;
  dryRun: true;
  records: CoupangProductRecord[];
}

export class CoupangAffiliateConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoupangAffiliateConfigError';
  }
}

export function validateCoupangAffiliateConfig(config: CoupangAffiliateConfig): void {
  if (config.dryRun !== true) {
    throw new CoupangAffiliateConfigError('Coupang affiliate adapter draft only supports dryRun: true.');
  }

  if (!Array.isArray(config.records)) {
    throw new CoupangAffiliateConfigError('Coupang affiliate config requires records.');
  }
}
