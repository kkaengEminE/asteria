import { normalizePromptTags } from './ImagePrompt.ts';

export interface ProductPrompt {
  prompt: string;
  suggestedCategories?: string[];
  suggestedTags?: string[];
}

export class ProductPromptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductPromptValidationError';
  }
}

export function createProductPrompt(productPrompt: ProductPrompt): ProductPrompt {
  validateProductPrompt(productPrompt);

  return {
    prompt: productPrompt.prompt.trim(),
    suggestedCategories: normalizePromptTags(productPrompt.suggestedCategories),
    suggestedTags: normalizePromptTags(productPrompt.suggestedTags)
  };
}

export function validateProductPrompt(productPrompt: ProductPrompt): void {
  if (!productPrompt.prompt || productPrompt.prompt.trim().length === 0) {
    throw new ProductPromptValidationError('Product prompt requires prompt.');
  }
}
