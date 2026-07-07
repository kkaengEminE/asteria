import type { WorkflowContext, WorkflowStep, WorkflowStepResult } from '../../workflows/index.ts';

export interface DryRunStepDefinition {
  name: string;
  execute(context: WorkflowContext): Promise<WorkflowContext>;
}

export class DryRunStepFactory {
  createStep(definition: DryRunStepDefinition): WorkflowStep {
    return {
      name: definition.name,
      async execute(context): Promise<WorkflowStepResult> {
        const nextContext = await definition.execute(context);
        return createDryRunStepResult(definition.name, nextContext);
      }
    };
  }
}

export function createDryRunStepResult(stepName: string, context: WorkflowContext): WorkflowStepResult {
  return {
    stepName,
    status: 'success',
    context
  };
}

export function requireWorkflowData<TValue>(context: WorkflowContext, key: string): TValue {
  const value = context.data[key];

  if (value === undefined) {
    throw new Error(`Missing workflow data: ${key}`);
  }

  return value as TValue;
}

