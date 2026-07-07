# Asteria

Asteria is the foundation for an extensible AI Publishing OS: a reusable content automation engine that can run multiple magazines from shared interfaces, configuration, prompts, and workflows.

## Current Sprint

Sprint 06 adds the first Cat Magazine MVP dry run. It verifies config loading, prompt rendering, mock provider resolution, workflow execution, mock article generation, SEO preview, and publish preview without external APIs.

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

Install dependencies before running type checking in a fresh environment:

```bash
npm install
```
