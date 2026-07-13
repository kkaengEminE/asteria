export interface InstagramCaption {
  short: string;
  long: string;
  cta: string;
}

export class InstagramCaptionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstagramCaptionValidationError';
  }
}

export function createInstagramCaption(caption: InstagramCaption): InstagramCaption {
  if (!caption.short || caption.short.trim().length === 0) {
    throw new InstagramCaptionValidationError('Instagram caption requires short text.');
  }

  if (!caption.long || caption.long.trim().length === 0) {
    throw new InstagramCaptionValidationError('Instagram caption requires long text.');
  }

  if (!caption.cta || caption.cta.trim().length === 0) {
    throw new InstagramCaptionValidationError('Instagram caption requires CTA.');
  }

  return {
    short: caption.short.trim(),
    long: caption.long.trim(),
    cta: caption.cta.trim()
  };
}
