export interface ImagePrompt {
  prompt: string;
  suggestedTags?: string[];
  mood?: string;
}

export class ImagePromptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImagePromptValidationError';
  }
}

export function createImagePrompt(imagePrompt: ImagePrompt): ImagePrompt {
  validateImagePrompt(imagePrompt);

  return {
    prompt: imagePrompt.prompt.trim(),
    suggestedTags: normalizePromptTags(imagePrompt.suggestedTags),
    mood: imagePrompt.mood?.trim()
  };
}

export function validateImagePrompt(imagePrompt: ImagePrompt): void {
  if (!imagePrompt.prompt || imagePrompt.prompt.trim().length === 0) {
    throw new ImagePromptValidationError('Image prompt requires prompt.');
  }
}

export function normalizePromptTags(tags: string[] = []): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))).sort();
}
