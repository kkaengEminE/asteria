import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WorkflowContext, WorkflowStep, WorkflowStepResult } from '../src/workflows/index.ts';
import { SequentialWorkflowEngine } from '../src/workflows/index.ts';

test('successful workflow executes all registered steps', async () => {
  const engine = new SequentialWorkflowEngine({ name: 'daily-publishing-dry-run' });

  engine
    .register(createDataStep('Research', 'researchComplete', true))
    .register(createDataStep('Generate', 'draftComplete', true))
    .register(createDataStep('Publish', 'publishPreviewComplete', true));

  const result = await engine.execute(createContext());

  assert.equal(result.status, 'success');
  assert.equal(result.steps.length, 3);
  assert.equal(result.context.data.researchComplete, true);
  assert.equal(result.context.data.draftComplete, true);
  assert.equal(result.context.data.publishPreviewComplete, true);
});

test('workflow stops on step failure and returns failed result', async () => {
  const engine = new SequentialWorkflowEngine({ name: 'failure-example' });

  engine
    .register(createDataStep('Research', 'researchComplete', true))
    .register({
      name: 'Generate',
      async execute(context): Promise<WorkflowStepResult> {
        return {
          stepName: 'Generate',
          status: 'failed',
          context,
          message: 'Draft generation failed.',
          error: 'Missing prompt template.',
          retryable: false
        };
      }
    })
    .register(createDataStep('Publish', 'publishComplete', true));

  const result = await engine.execute(createContext());

  assert.equal(result.status, 'failed');
  assert.equal(result.steps.length, 2);
  assert.equal(result.steps[1].stepName, 'Generate');
  assert.equal(result.context.data.publishComplete, undefined);
});

test('workflow preserves execution order', async () => {
  const order: string[] = [];
  const engine = new SequentialWorkflowEngine({ name: 'ordered-workflow' });

  engine
    .register(createOrderedStep('Research', order))
    .register(createOrderedStep('Generate', order))
    .register(createOrderedStep('Publish', order));

  const result = await engine.execute(createContext());

  assert.equal(result.status, 'success');
  assert.deepEqual(order, ['Research', 'Generate', 'Publish']);
  assert.deepEqual(
    result.steps.map((step) => step.stepName),
    ['Research', 'Generate', 'Publish']
  );
});

test('workflow cancellation stops before the next step', async () => {
  const engine = new SequentialWorkflowEngine({ name: 'cancelled-workflow' });

  engine
    .register({
      name: 'Research',
      async execute(context): Promise<WorkflowStepResult> {
        engine.cancel('Manual cancellation requested.');

        return {
          stepName: 'Research',
          status: 'success',
          context: {
            ...context,
            data: {
              ...context.data,
              researchComplete: true
            }
          }
        };
      }
    })
    .register(createDataStep('Generate', 'draftComplete', true));

  const result = await engine.execute(createContext());

  assert.equal(result.status, 'cancelled');
  assert.equal(result.message, 'Manual cancellation requested.');
  assert.equal(result.steps.length, 1);
  assert.equal(result.context.data.researchComplete, true);
  assert.equal(result.context.data.draftComplete, undefined);
});

function createContext(): WorkflowContext {
  return {
    workflowId: 'test-workflow',
    magazineSlug: 'cat',
    dryRun: true,
    data: {}
  };
}

function createDataStep(name: string, key: string, value: unknown): WorkflowStep {
  return {
    name,
    async execute(context): Promise<WorkflowStepResult> {
      return {
        stepName: name,
        status: 'success',
        context: {
          ...context,
          data: {
            ...context.data,
            [key]: value
          }
        }
      };
    }
  };
}

function createOrderedStep(name: string, order: string[]): WorkflowStep {
  return {
    name,
    async execute(context): Promise<WorkflowStepResult> {
      order.push(name);

      return {
        stepName: name,
        status: 'success',
        context
      };
    }
  };
}

