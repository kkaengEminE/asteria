import { normalizeTags } from './Tag.ts';

export interface OpenGraphMetadata {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
}

export interface TwitterCardMetadata {
  title?: string;
  description?: string;
  image?: string;
  card?: 'summary' | 'summary_large_image' | string;
}

export interface SEO {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  canonical?: string;
  openGraph?: OpenGraphMetadata;
  twitterCard?: TwitterCardMetadata;
}

export class SEOValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SEOValidationError';
  }
}

export function createSEO(seo: SEO): SEO {
  validateSEO(seo);

  return {
    ...seo,
    keywords: normalizeTags(seo.keywords).map((tag) => tag.name)
  };
}

export function validateSEO(seo: SEO): void {
  if (!seo.metaTitle || seo.metaTitle.trim().length === 0) {
    throw new SEOValidationError('SEO requires metaTitle.');
  }

  if (!seo.metaDescription || seo.metaDescription.trim().length === 0) {
    throw new SEOValidationError('SEO requires metaDescription.');
  }

  if (seo.canonical && !isHttpUrl(seo.canonical)) {
    throw new SEOValidationError('SEO canonical must be an http or https URL.');
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

