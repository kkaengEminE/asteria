import type { DryRunStepFactory } from '../../../services/dryRun/index.ts';
import type { WorkflowStep } from '../../../workflows/index.ts';
import type { MagazineDryRunStepOptions } from './stepDefinitions.ts';
import {
  createGenerateArticleStep,
  createGeneratePublishingPackageStep,
  createGenerateSeoStep,
  createLoadConfigStep,
  createLoadPromptStep,
  createResearchStep
} from './stepDefinitions.ts';

export function createContentSteps(
  stepFactory: DryRunStepFactory,
  options: MagazineDryRunStepOptions
): WorkflowStep[] {
  return [
    createLoadConfigStep(stepFactory, options),
    createLoadPromptStep(stepFactory, options),
    createResearchStep(stepFactory, options),
    createGeneratePublishingPackageStep(stepFactory, options)
  ];
}

export function createLegacyContentPreviewSteps(
  stepFactory: DryRunStepFactory,
  options: MagazineDryRunStepOptions
): WorkflowStep[] {
  return [
    createGenerateArticleStep(stepFactory, options),
    createGenerateSeoStep(stepFactory, options)
  ];
}
