# ADR 0015: Content Domain

## Context

Asteria now has a provider-agnostic AI Provider Foundation. Before integrating real AI providers, Asteria needs a canonical content model that generated output can be parsed into and validated against.

Without this domain boundary, OpenAI, Claude, Gemini, or local LLM output shapes could leak into workflows, publishers, or magazine modules.

## Decision

Asteria will define the Content Domain under `src/domain/content`.

The domain includes:

- Article.
- Article metadata.
- Article sections.
- SEO metadata.
- FAQ entries.
- Category.
- Tag.
- Content status.
- Content generation result.
- Validation, slug generation, tag normalization, and metadata normalization helpers.

The Content Domain will not know about OpenAI, Claude, Gemini, WordPress, workflows, prompt files, or provider adapters.

Future AI providers should produce or be transformed into `ContentGenerationResult` before content moves into publishing, social generation, review, or analytics workflows.

## Consequences

Real AI adapters can return provider-specific raw output while application services normalize it into stable domain models. Publishers and workflows can depend on validated content rather than provider-specific strings.

The tradeoff is that future real generation work needs a parsing or mapping layer between AI responses and `ContentGenerationResult`.
