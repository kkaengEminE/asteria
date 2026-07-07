export interface WorkflowContext {
  workflowId?: string;
  magazineSlug?: string;
  dryRun: boolean;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function cloneWorkflowContext(context: WorkflowContext): WorkflowContext {
  return {
    ...context,
    data: { ...context.data },
    metadata: context.metadata ? { ...context.metadata } : undefined
  };
}

