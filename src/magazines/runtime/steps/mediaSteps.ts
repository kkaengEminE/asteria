import type { DryRunStepFactory } from '../../../services/dryRun/index.ts';
import type { WorkflowStep } from '../../../workflows/index.ts';
import type { MagazineDryRunStepOptions } from './stepDefinitions.ts';
import { createSelectImageStep } from './stepDefinitions.ts';

export function createMediaSteps(
  stepFactory: DryRunStepFactory,
  options: MagazineDryRunStepOptions
): WorkflowStep[] {
  return [
    createSelectImageStep(stepFactory, options)
  ];
}
