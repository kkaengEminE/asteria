import type { WorkflowContext } from './WorkflowContext.ts';
import type { WorkflowStepResult } from './WorkflowResult.ts';

export interface WorkflowStep {
  readonly name: string;
  execute(context: WorkflowContext): Promise<WorkflowStepResult>;
  rollback?(context: WorkflowContext): Promise<void>;
}

