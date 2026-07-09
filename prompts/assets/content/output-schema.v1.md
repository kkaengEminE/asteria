Return only valid JSON matching this provider-neutral shape:

{
  "article": {
    "title": "...",
    "subtitle": "...",
    "summary": "...",
    "body": "...",
    "slug": "...",
    "language": "...",
    "author": "...",
    "createdAt": "ISO date string"
  },
  "summary": {
    "text": "...",
    "bullets": ["..."]
  },
  "seo": {
    "metaTitle": "...",
    "metaDescription": "...",
    "keywords": ["..."]
  },
  "faq": [
    {
      "question": "...",
      "answer": "..."
    }
  ],
  "imagePrompt": {
    "prompt": "...",
    "suggestedTags": ["..."],
    "mood": "..."
  },
  "productPrompt": {
    "prompt": "...",
    "suggestedCategories": ["..."],
    "suggestedTags": ["..."]
  }
}
