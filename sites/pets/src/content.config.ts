import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './.generated/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    categoryLabel: z.string(),
    publishedAt: z.coerce.date()
  })
});

export const collections = { articles };
