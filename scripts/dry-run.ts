import { runCatMagazineDryRun } from '../src/magazines/cat/index.ts';

const topic = process.argv.slice(2).join(' ') || undefined;
const result = await runCatMagazineDryRun({ topic });

console.log(formatDryRunReport(result));

function formatDryRunReport(result: Awaited<ReturnType<typeof runCatMagazineDryRun>>): string {
  return [
    'Asteria Dry Run',
    '',
    `Magazine: ${result.magazine?.name ?? 'Unavailable'}`,
    `Topic: ${result.topic}`,
    `Workflow Status: ${result.workflowStatus}`,
    `Executed Steps: ${result.executedSteps.length > 0 ? result.executedSteps.join(' -> ') : 'None'}`,
    '',
    'Rendered Prompt Preview:',
    result.renderedPromptPreview ?? 'Unavailable',
    '',
    'Generated Mock Article:',
    result.articlePreview ?? 'Unavailable',
    '',
    'SEO Preview:',
    result.seoPreview ?? 'Unavailable',
    '',
    'Selected Image:',
    result.selectedImage
      ? [
          `Filename: ${result.selectedImage.filename}`,
          `Tags: ${result.selectedImage.tags.join(', ')}`,
          `Category: ${result.selectedImage.category ?? 'Uncategorized'}`,
          `Score: ${result.imageSelectionReason?.score ?? 'Unavailable'}`,
          `Preview URI: ${result.imagePreview ?? 'Unavailable'}`
        ].join('\n')
      : 'Unavailable',
    '',
    'Publish Preview:',
    result.publishPreview
      ? `${result.publishPreview.status}: ${result.publishPreview.message ?? 'Dry-run preview generated.'}`
      : 'Unavailable',
    '',
    result.error ? `Error: ${result.error}` : 'No external APIs were called. Nothing was published.'
  ].join('\n');
}
