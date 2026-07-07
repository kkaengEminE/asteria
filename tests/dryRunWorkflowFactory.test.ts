import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DryRunWorkflowFactory } from '../src/services/dryRun/index.ts';
import type { WorkflowStep } from '../src/workflows/index.ts';

test('shared dry-run factory builds and executes workflow', async () => {
  const factory = new DryRunWorkflowFactory();
  const steps: WorkflowStep[] = [
    {
      name: 'Prepare',
      async execute(context) {
        return {
          stepName: 'Prepare',
          status: 'success',
          context: {
            ...context,
            data: {
              ...context.data,
              articlePrompt: 'Write about cats.',
              articlePreview: 'Mock article preview.',
              seoPreview: 'Mock SEO preview.'
            }
          }
        };
      }
    }
  ];

  const workflowResult = await factory.execute({
    workflowName: 'shared-dry-run-test',
    workflowId: 'shared-dry-run-test',
    magazineSlug: 'cat',
    topic: 'cat care',
    steps
  });
  const dryRunResult = factory.createResult({
    topic: 'cat care',
    workflowResult
  });

  assert.equal(workflowResult.status, 'success');
  assert.equal(dryRunResult.workflowStatus, 'success');
  assert.deepEqual(dryRunResult.executedSteps, ['Prepare']);
  assert.equal(dryRunResult.renderedPromptPreview, 'Write about cats.');
  assert.equal(dryRunResult.articlePreview, 'Mock article preview.');
  assert.equal(dryRunResult.seoPreview, 'Mock SEO preview.');
});

