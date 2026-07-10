import type { CoupangProductRecord } from './CoupangProductRecord.ts';
import type { CoupangAffiliateTransport } from './CoupangAffiliateTransport.ts';
import type { AuditLog } from '../../../services/auditLog/index.ts';
import type { RetryService } from '../../../services/retry/index.ts';

export interface CoupangAffiliateConfig {
  name?: string;
  dryRun?: boolean;
  enabled?: boolean;
  records?: CoupangProductRecord[];
  accessKey?: string;
  secretKey?: string;
  partnerId?: string;
  baseUrl?: string;
  transport?: CoupangAffiliateTransport;
  auditLog?: AuditLog;
  retryService?: RetryService;
}

export class CoupangAffiliateConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoupangAffiliateConfigError';
  }
}

export function validateCoupangAffiliateConfig(config: CoupangAffiliateConfig): void {
  if (config.dryRun !== false && !Array.isArray(config.records)) {
    throw new CoupangAffiliateConfigError('Coupang affiliate config requires records.');
  }

  if (config.dryRun === false && config.enabled !== true) {
    throw new CoupangAffiliateConfigError(
      'Coupang production mode is disabled. Set COUPANG_ENABLED=true to enable production affiliate requests.'
    );
  }

  if (config.dryRun === false) {
    const missing = [
      ['COUPANG_ACCESS_KEY', config.accessKey],
      ['COUPANG_SECRET_KEY', config.secretKey],
      ['COUPANG_PARTNER_ID', config.partnerId]
    ]
      .filter(([, value]) => typeof value !== 'string' || value.trim().length === 0)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new CoupangAffiliateConfigError(`Coupang credentials are missing: ${missing.join(', ')}.`);
    }
  }
}

export interface CoupangEnvironment {
  COUPANG_ENABLED?: string;
  COUPANG_ACCESS_KEY?: string;
  COUPANG_SECRET_KEY?: string;
  COUPANG_PARTNER_ID?: string;
  COUPANG_BASE_URL?: string;
}

export function createCoupangAffiliateConfigFromEnv(
  env: CoupangEnvironment = process.env
): Partial<CoupangAffiliateConfig> {
  return {
    dryRun: false,
    enabled: env.COUPANG_ENABLED === 'true',
    accessKey: env.COUPANG_ACCESS_KEY,
    secretKey: env.COUPANG_SECRET_KEY,
    partnerId: env.COUPANG_PARTNER_ID,
    baseUrl: env.COUPANG_BASE_URL
  };
}
