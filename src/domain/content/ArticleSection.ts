export interface ArticleSection {
  heading: string;
  body: string;
  level?: number;
}

export class ArticleSectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArticleSectionValidationError';
  }
}

export function validateArticleSection(section: ArticleSection): void {
  if (!section.heading || section.heading.trim().length === 0) {
    throw new ArticleSectionValidationError('Article section requires heading.');
  }

  if (!section.body || section.body.trim().length === 0) {
    throw new ArticleSectionValidationError('Article section requires body.');
  }

  if (section.level !== undefined && section.level < 1) {
    throw new ArticleSectionValidationError('Article section level must be greater than 0.');
  }
}

