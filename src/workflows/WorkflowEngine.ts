import { cloneWorkflowContext, type WorkflowContext } from './WorkflowContext.ts';
import type { WorkflowResult, WorkflowStepResult } from './WorkflowResult.ts';
import type { WorkflowStep } from './WorkflowStep.ts';

export interface WorkflowLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface WorkflowEngine {
  register(step: WorkflowStep): WorkflowEngine;
  execute(initialContext: WorkflowContext): Promise<WorkflowResult>;
  cancel(reason?: string): void;
}

export interface SequentialWorkflowEngineOptions {
  name?: string;
  logger?: WorkflowLogger;
}

export class SequentialWorkflowEngine implements WorkflowEngine {
  private readonly workflowName: string;
  private readonly logger?: WorkflowLogger;
  private readonly steps: WorkflowStep[] = [];
  private cancellationReason: string | undefined;

  constructor(options: SequentialWorkflowEngineOptions = {}) {
    this.workflowName = options.name ?? 'sequential-workflow';
    this.logger = options.logger;
  }

  register(step: WorkflowStep): WorkflowEngine {
    this.steps.push(step);
    return this;
  }

  cancel(reason = 'Workflow cancelled.'): void {
    this.cancellationReason = reason;
  }

  async execute(initialContext: WorkflowContext): Promise<WorkflowResult> {
    let context = cloneWorkflowContext(initialContext);
    const results: WorkflowStepResult[] = [];

    this.logger?.info('Workflow started.', { workflowName: this.workflowName });

    for (const step of this.steps) {
      if (this.cancellationReason) {
        return this.cancelledResult(context, results);
      }

      this.logger?.info('Workflow step started.', { stepName: step.name });

      try {
        const result = await step.execute(context);
        results.push(result);
        context = cloneWorkflowContext(result.context);

        if (result.status === 'failed') {
          this.logger?.error('Workflow step failed.', { stepName: step.name, error: result.error });

          return {
            workflowName: this.workflowName,
            status: 'failed',
            context,
            steps: results,
            message: result.message ?? `Workflow stopped at failed step: ${step.name}`
          };
        }

        if (result.status === 'cancelled') {
          this.cancel(result.message);
          return this.cancelledResult(context, results);
        }
      } catch (error) {
        const failedResult: WorkflowStepResult = {
          stepName: step.name,
          status: 'failed',
          context,
          message: `Workflow stopped at failed step: ${step.name}`,
          error: error instanceof Error ? error.message : String(error),
          retryable: false
        };

        results.push(failedResult);
        this.logger?.error('Workflow step threw an error.', { stepName: step.name, error: failedResult.error });

        return {
          workflowName: this.workflowName,
          status: 'failed',
          context,
          steps: results,
          message: failedResult.message
        };
      }
    }

    this.logger?.info('Workflow completed.', { workflowName: this.workflowName });

    return {
      workflowName: this.workflowName,
      status: 'success',
      context,
      steps: results
    };
  }

  private cancelledResult(context: WorkflowContext, steps: WorkflowStepResult[]): WorkflowResult {
    return {
      workflowName: this.workflowName,
      status: 'cancelled',
      context,
      steps,
      message: this.cancellationReason
    };
  }
}

