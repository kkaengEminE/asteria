import type { DryRunStepFactory } from '../../../services/dryRun/index.ts';
import type { WorkflowStep } from '../../../workflows/index.ts';
import type { MagazineDryRunStepOptions } from './stepDefinitions.ts';
import { createGenerateMonetizationPreviewStep } from './stepDefinitions.ts';

export function createMonetizationSteps(
  stepFactory: DryRunStepFactory,
  options: MagazineDryRunStepOptions
): WorkflowStep[] {
  return [
    createGenerateMonetizationPreviewStep(stepFactory, options)
  ];
}
