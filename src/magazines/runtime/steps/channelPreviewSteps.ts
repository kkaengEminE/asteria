import type { DryRunStepFactory } from '../../../services/dryRun/index.ts';
import type { WorkflowStep } from '../../../workflows/index.ts';
import type { MagazineDryRunStepOptions } from './stepDefinitions.ts';
import {
  createGenerateInstagramPreviewStep,
  createGeneratePodcastPreviewStep
} from './stepDefinitions.ts';

export function createChannelPreviewSteps(
  stepFactory: DryRunStepFactory,
  options: MagazineDryRunStepOptions
): WorkflowStep[] {
  return [
    createGenerateInstagramPreviewStep(stepFactory, options),
    createGeneratePodcastPreviewStep(stepFactory, options)
  ];
}
