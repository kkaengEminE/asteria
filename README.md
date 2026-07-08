# Asteria

Asteria is the foundation for an extensible AI Publishing OS: a reusable content automation engine that can run multiple magazines from shared interfaces, configuration, prompts, and workflows.

## Current Sprint

Sprint 17 adds the OpenAI Adapter behind the provider-agnostic AI boundary. It is optional, reads configuration from environment variables only, uses an injectable transport for tests, and remains disabled for production calls unless explicitly enabled. The Cat dry run still uses the deterministic Mock AI provider by default.

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

The dry run prints recommended product names, recommendation reasons, mock affiliate links, disclosure text, selected image filename, tags, category, score, and mock preview URI.

OpenAI is not required for local dry runs or tests. Future production usage must provide environment configuration such as `OPENAI_API_KEY` and explicitly enable production mode with `OPENAI_PRODUCTION_ENABLED=true`.

Install dependencies before running type checking in a fresh environment:

```bash
npm install
```
