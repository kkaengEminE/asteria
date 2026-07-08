# Asteria

Asteria is the foundation for an extensible AI Publishing OS: a reusable content automation engine that can run multiple magazines from shared interfaces, configuration, prompts, and workflows.

## Current Sprint

Sprint 15 adds the AI Provider Foundation. It verifies provider-agnostic AI request, response, usage, error, health check, token counting, streaming shape, deterministic mock generation, Provider Registry resolution, and Cat Magazine dry-run integration without external APIs.

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

Install dependencies before running type checking in a fresh environment:

```bash
npm install
```
