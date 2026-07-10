import type { MagazineDryRunOptions } from '../runtime/index.ts';
import { runMagazineDryRun } from '../runtime/index.ts';

export type DogMagazineDryRunOptions = MagazineDryRunOptions;

export function runDogMagazineDryRun(options: DogMagazineDryRunOptions = {}) {
  return runMagazineDryRun({
    ...options,
    magazineSlug: options.magazineSlug ?? 'dog'
  });
}
