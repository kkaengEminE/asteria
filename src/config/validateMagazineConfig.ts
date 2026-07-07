import type { MagazineConfig, MagazineSchedule } from '../core/MagazineConfig.ts';
import type { PublishingDestination } from '../core/types.ts';

export class MagazineConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MagazineConfigValidationError';
  }
}

const requiredStringFields = [
  'name',
  'slug',
  'language',
  'audience',
  'tone',
  'imageSource',
  'promptSet'
] as const;

export function validateMagazineConfig(value: unknown): MagazineConfig {
  if (!isRecord(value)) {
    throw new MagazineConfigValidationError('Magazine config must be a JSON object.');
  }

  for (const field of requiredStringFields) {
    if (!isNonEmptyString(value[field])) {
      throw new MagazineConfigValidationError(`Missing or invalid required field: ${field}`);
    }
  }

  if (!isStringArray(value.topics)) {
    throw new MagazineConfigValidationError('Missing or invalid required field: topics');
  }

  if (!isPublishingDestinationArray(value.publishingDestinations)) {
    throw new MagazineConfigValidationError('Missing or invalid required field: publishingDestinations');
  }

  if (!isMagazineSchedule(value.schedule)) {
    throw new MagazineConfigValidationError('Missing or invalid required field: schedule');
  }

  if (value.affiliateProvider !== undefined && typeof value.affiliateProvider !== 'string') {
    throw new MagazineConfigValidationError('Invalid optional field: affiliateProvider');
  }

  if (value.metadata !== undefined && !isRecord(value.metadata)) {
    throw new MagazineConfigValidationError('Invalid optional field: metadata');
  }

  return value as unknown as MagazineConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function isMagazineSchedule(value: unknown): value is MagazineSchedule {
  if (!isRecord(value)) {
    return false;
  }

  return isNonEmptyString(value.timezone) && isNonEmptyString(value.cadence);
}

function isPublishingDestinationArray(value: unknown): value is PublishingDestination[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((destination) => {
      if (!isRecord(destination)) {
        return false;
      }

      return (
        isNonEmptyString(destination.type) &&
        isNonEmptyString(destination.name) &&
        typeof destination.enabled === 'boolean' &&
        (destination.dryRunOnly === undefined || typeof destination.dryRunOnly === 'boolean') &&
        (destination.metadata === undefined || isRecord(destination.metadata))
      );
    })
  );
}

