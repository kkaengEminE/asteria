export interface FAQ {
  question: string;
  answer: string;
}

export class FAQValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FAQValidationError';
  }
}

export function createFAQ(faq: FAQ): FAQ {
  validateFAQ(faq);

  return {
    question: faq.question.trim(),
    answer: faq.answer.trim()
  };
}

export function validateFAQ(faq: FAQ): void {
  if (!faq.question || faq.question.trim().length === 0) {
    throw new FAQValidationError('FAQ requires question.');
  }

  if (!faq.answer || faq.answer.trim().length === 0) {
    throw new FAQValidationError('FAQ requires answer.');
  }
}

