import type {
  MagazineDryRunAIMode,
  MagazineDryRunOptions,
  RegisterMagazineDryRunMockProviderOptions
} from '../runtime/index.ts';
import {
  registerMagazineDryRunMockProviders,
  runMagazineDryRun
} from '../runtime/index.ts';

export type CatDryRunAIMode = MagazineDryRunAIMode;
export type CatMagazineDryRunOptions = MagazineDryRunOptions;
export type RegisterCatDryRunMockProviderOptions = RegisterMagazineDryRunMockProviderOptions;

export function runCatMagazineDryRun(options: CatMagazineDryRunOptions = {}) {
  return runMagazineDryRun({
    ...options,
    magazineSlug: options.magazineSlug ?? 'cat'
  });
}

export const registerCatDryRunMockProviders = registerMagazineDryRunMockProviders;
