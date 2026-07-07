import type { WorkflowContext } from './WorkflowContext.ts';
import type { WorkflowStatus } from './WorkflowStatus.ts';

export interface WorkflowStepResult {
  stepName: string;
  status: WorkflowStatus;
  context: WorkflowContext;
  message?: string;
  error?: string;
  retryable?: boolean;
}

export interface WorkflowResult {
  workflowName: string;
  status: Extract<WorkflowStatus, 'success' | 'failed' | 'cancelled'>;
  context: WorkflowContext;
  steps: WorkflowStepResult[];
  message?: string;
}

