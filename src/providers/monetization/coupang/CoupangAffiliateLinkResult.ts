import type { AffiliateLink } from '../../../domain/monetization/index.ts';

export interface CoupangAffiliateLinkResult extends AffiliateLink {
  readonly provider: 'coupang';
  readonly metadata: {
    dryRun: true;
    coupangProductId?: string;
    productionLink: false;
  };
}
