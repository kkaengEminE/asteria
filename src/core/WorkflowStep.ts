export interface WorkflowContext {
  magazineSlug?: string;
  dryRun: boolean;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStepResult {
  status: 'success' | 'skipped' | 'failed';
  context: WorkflowContext;
  message?: string;
  retryable?: boolean;
}

export interface WorkflowStep {
  readonly name: string;
  execute(context: WorkflowContext): Promise<WorkflowStepResult>;
}

