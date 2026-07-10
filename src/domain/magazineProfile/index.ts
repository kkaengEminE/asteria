export type {
  MagazineAffiliatePolicy,
  MagazineImageStyle,
  MagazineProfile,
  MagazineSeoPolicy
} from './MagazineProfile.ts';
export {
  MagazineProfileLoadError,
  MagazineProfileNotFoundError,
  MagazineProfileRegistry,
  loadMagazineProfile
} from './MagazineProfileRegistry.ts';
export type { MagazineProfileRegistryOptions } from './MagazineProfileRegistry.ts';
export {
  MagazineProfileValidationError,
  validateMagazineProfile
} from './validateMagazineProfile.ts';
