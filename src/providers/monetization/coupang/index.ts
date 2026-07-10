export {
  CoupangAffiliateProvider,
  coupangAffiliateProviderToken,
  mapCoupangRecordToProduct
} from './CoupangAffiliateProvider.ts';
export {
  createCoupangAffiliateConfigFromEnv,
  CoupangAffiliateConfigError,
  validateCoupangAffiliateConfig
} from './CoupangAffiliateConfig.ts';
export type { CoupangAffiliateConfig, CoupangEnvironment } from './CoupangAffiliateConfig.ts';
export type { CoupangAffiliateLinkResult } from './CoupangAffiliateLinkResult.ts';
export type {
  CoupangAffiliateLinkTransportRequest,
  CoupangAffiliateLinkTransportResponse,
  CoupangAffiliateTransport,
  CoupangAffiliateTransportRequest
} from './CoupangAffiliateTransport.ts';
export type { CoupangProductRecord, CoupangProductSearchResponse } from './CoupangProductRecord.ts';
