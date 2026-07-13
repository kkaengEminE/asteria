import type { WorkflowStep } from '../../workflows/index.ts';
import { DryRunStepFactory } from '../../services/dryRun/index.ts';
import { DryRunPublisher, PublisherService } from '../../services/publisher/index.ts';
import { PublishingQueue } from '../../services/publishingQueue/index.ts';
import { ScheduledJobExecutor, SchedulerService } from '../../services/scheduler/index.ts';
import { createChannelPreviewSteps } from './steps/channelPreviewSteps.ts';
import { createContentSteps, createLegacyContentPreviewSteps } from './steps/contentSteps.ts';
import { createMediaSteps } from './steps/mediaSteps.ts';
import { createMonetizationSteps } from './steps/monetizationSteps.ts';
import { createPublishingSteps } from './steps/publishingSteps.ts';
import type { MagazineDryRunStepOptions } from './steps/stepDefinitions.ts';

export type { MagazineDryRunStepOptions } from './steps/stepDefinitions.ts';

export function createMagazineDryRunSteps(options: MagazineDryRunStepOptions): WorkflowStep[] {
  const stepFactory = new DryRunStepFactory();
  const publishingQueue = new PublishingQueue({
    auditLog: options.auditLog,
    metricsService: options.metricsService
  });
  const schedulerService = new SchedulerService({
    auditLog: options.auditLog,
    queue: publishingQueue,
    metricsService: options.metricsService
  });
  const publisherService = new PublisherService({
    auditLog: options.auditLog,
    metricsService: options.metricsService,
    publisher: new DryRunPublisher({
      name: 'dry-run-publisher'
    }),
    publishingEnabled: false
  });
  const scheduledJobExecutor = new ScheduledJobExecutor({
    auditLog: options.auditLog,
    metricsService: options.metricsService,
    queue: publishingQueue,
    scheduler: schedulerService,
    publisherService
  });

  return [
    ...createContentSteps(stepFactory, options),
    ...createMediaSteps(stepFactory, options),
    ...createChannelPreviewSteps(stepFactory, options),
    ...createLegacyContentPreviewSteps(stepFactory, options),
    ...createMonetizationSteps(stepFactory, options),
    ...createPublishingSteps(stepFactory, options, {
      publishingQueue,
      schedulerService,
      scheduledJobExecutor
    })
  ];
}
