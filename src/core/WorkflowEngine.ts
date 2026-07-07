import type { WorkflowContext, WorkflowStep, WorkflowStepResult } from './WorkflowStep';

export interface WorkflowRunResult {
  status: 'success' | 'failed';
  context: WorkflowContext;
  steps: WorkflowStepResult[];
}

export interface WorkflowEngine {
  run(steps: WorkflowStep[], initialContext: WorkflowContext): Promise<WorkflowRunResult>;
}

