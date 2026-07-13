import type { DryRunResult } from '../../../src/services/dryRun/index.ts';

export function formatSelectedImage(result: DryRunResult): string {
  return result.selectedImage
    ? [
        `Filename: ${result.selectedImage.filename}`,
        `Tags: ${result.selectedImage.tags.join(', ')}`,
        `Category: ${result.selectedImage.category ?? 'Uncategorized'}`,
        `Score: ${result.imageSelectionReason?.score ?? 'Unavailable'}`,
        `Preview URI: ${result.imagePreview ?? 'Unavailable'}`
      ].join('\n')
    : 'Unavailable';
}
