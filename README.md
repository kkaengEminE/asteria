# Asteria

Asteria is the foundation for an extensible AI Publishing OS: a reusable content automation engine that can run multiple magazines from shared interfaces, configuration, prompts, and workflows.

## Current Sprint

Sprint 26 adds the Editorial Approval Gate. Generated PublishingPackages now receive provider-neutral approval metadata with APPROVED, NEEDS_REVIEW, or REJECTED decisions based on validation, quality, editorial review, and threshold results. Publishing remains disabled.

## Commands

```bash
npm run dry-run
npm test
npm run typecheck
```

Run the dry run with a custom topic:

```bash
npm run dry-run -- "indoor enrichment"
```

Run the dry run with production AI mode only when OpenAI configuration is intentionally enabled:

```bash
npm run dry-run -- --ai openai "indoor enrichment"
```

Production AI mode requires `OPENAI_PRODUCTION_ENABLED=true` and `OPENAI_API_KEY`. Without both, the dry run fails clearly before any external request is made.

The dry run prints the assembled PublishingPackage, prompt profile, prompt stack, prompt id, prompt version, rendered variables, composed prompt preview, retry count, validation result, validation report, quality score, quality report, review score, review result, review summary, review issues, threshold result, article title, article word and character count, SEO title and description, FAQ count, approval decision, approval reasons, blocking issues, recommendations, generation duration, recommended product names, recommendation reasons, mock affiliate links, disclosure text, selected image filename, tags, category, score, and mock preview URI.

OpenAI is not required for local dry runs or tests. Production AI dry runs must provide environment configuration such as `OPENAI_API_KEY` and explicitly enable production mode with `OPENAI_PRODUCTION_ENABLED=true`. Publishing still remains disabled in both mock and OpenAI modes.

Install dependencies before running type checking in a fresh environment:

```bash
npm install
```
