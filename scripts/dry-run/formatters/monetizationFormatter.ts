import type { DryRunResult } from '../../../src/services/dryRun/index.ts';

export function formatMonetizationPreview(result: DryRunResult): string {
  if (!result.recommendedProducts || result.recommendedProducts.length === 0) {
    return result.monetizationPreview ?? 'Unavailable';
  }

  return [
    [
      `Provider: ${result.monetizationDiagnostics?.provider ?? 'Unavailable'}`,
      `Production Enabled: ${result.monetizationDiagnostics?.productionEnabled ?? false}`,
      `Request Count: ${result.monetizationDiagnostics?.requestCount ?? 0}`,
      `Retry Count: ${result.monetizationDiagnostics?.retryCount ?? 0}`,
      `Returned Products: ${result.monetizationDiagnostics?.returnedProductCount ?? result.recommendedProducts.length}`,
      `Failure Reason: ${result.monetizationDiagnostics?.failureReason ?? 'None'}`
    ].join('\n'),
    ...result.recommendedProducts.map((product, index) =>
      [
        `${index + 1}. ${product.name}`,
        `Reason: ${product.reason}`,
        `Score: ${product.score}`,
        `${result.affiliateLinks?.[index]?.metadata?.dryRun === false ? 'Affiliate Link' : 'Mock Link'}: ${result.affiliateLinks?.[index]?.url ?? 'Unavailable'}`
      ].join('\n')
    ),
    `Disclosure: ${result.affiliateDisclosure ?? 'Unavailable'}`
  ].join('\n\n');
}
