# ADR 0006: Shared Dry-Run Workflow

## Context

The Cat Magazine dry run proved the first end-to-end integration across config loading, prompt rendering, provider registry resolution, mock providers, workflow execution, and CLI output.

Future magazines should reuse the generic workflow construction and result-shaping pieces without copying Cat-specific implementation details.

## Decision

Asteria will introduce a shared dry-run workflow foundation under `src/services/dryRun`.

The shared layer will own:

- Dry-run result shape.
- Workflow construction.
- Dry-run workflow execution.
- Generic step helper utilities.
- Mapping workflow output into dry-run previews.

Magazine modules will continue to own:

- Magazine config choices.
- Prompt keys and variables.
- Provider tokens.
- Mock provider behavior.
- Magazine-specific step composition.

## Consequences

Future dry-run magazines can share a small foundation without forcing a broad workflow abstraction too early. The Cat Magazine module becomes thinner and clearer. The tradeoff is that shared dry-run services are intentionally modest; more advanced workflow factories should wait until a second magazine proves the need.

