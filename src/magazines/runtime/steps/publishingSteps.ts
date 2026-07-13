import type { DryRunStepFactory } from '../../../services/dryRun/index.ts';
import type { PublishingQueue } from '../../../services/publishingQueue/index.ts';
import type { ScheduledJobExecutor, SchedulerService } from '../../../services/scheduler/index.ts';
import type { WorkflowStep } from '../../../workflows/index.ts';
import type { MagazineDryRunStepOptions } from './stepDefinitions.ts';
import {
  createExecutionPreviewStep,
  createPublishPreviewStep,
  createSchedulePreviewStep
} from './stepDefinitions.ts';

export function createPublishingSteps(
  stepFactory: DryRunStepFactory,
  options: MagazineDryRunStepOptions,
  dependencies: {
    publishingQueue: PublishingQueue;
    schedulerService: SchedulerService;
    scheduledJobExecutor: ScheduledJobExecutor;
  }
): WorkflowStep[] {
  return [
    createPublishPreviewStep(stepFactory, options, dependencies.publishingQueue),
    createSchedulePreviewStep(stepFactory, options, dependencies.schedulerService),
    createExecutionPreviewStep(stepFactory, options, dependencies.scheduledJobExecutor)
  ];
}
