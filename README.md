# Asteria

Asteria is the foundation for an extensible AI Publishing OS: a reusable content automation engine that can run multiple magazines from shared interfaces, configuration, prompts, and workflows.

## Current Sprint

Sprint 11 integrates image selection into the Cat Magazine dry run. It verifies config loading, prompt rendering, mock provider resolution, image search/scoring/selection, workflow execution, mock article generation, SEO preview, selected image preview, and publish preview without external APIs.

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

The dry run prints the selected image filename, tags, category, score, and mock preview URI.

Install dependencies before running type checking in a fresh environment:

```bash
npm install
```
