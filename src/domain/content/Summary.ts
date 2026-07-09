export interface Summary {
  text: string;
  bullets?: string[];
}

export class SummaryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SummaryValidationError';
  }
}

export function createSummary(summary: Summary): Summary {
  validateSummary(summary);

  return {
    text: summary.text.trim(),
    bullets: summary.bullets?.map((bullet) => bullet.trim()).filter(Boolean)
  };
}

export function validateSummary(summary: Summary): void {
  if (!summary.text || summary.text.trim().length === 0) {
    throw new SummaryValidationError('Summary requires text.');
  }
}
