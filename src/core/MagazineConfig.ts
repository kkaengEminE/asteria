import type { LocaleCode, PublishingDestination } from './types';

export interface MagazineSchedule {
  timezone: string;
  cadence: 'daily' | 'weekly' | 'monthly' | string;
  time?: string;
  daysOfWeek?: string[];
}

export interface MagazineConfig {
  name: string;
  slug: string;
  language: LocaleCode;
  audience: string;
  tone: string;
  topics: string[];
  imageSource: string;
  affiliateProvider?: string;
  publishingDestinations: PublishingDestination[];
  schedule: MagazineSchedule;
  promptSet: string;
  metadata?: Record<string, unknown>;
}

