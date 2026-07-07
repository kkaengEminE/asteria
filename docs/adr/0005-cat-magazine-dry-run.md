# ADR 0005: Cat Magazine Dry Run

## Context

Asteria now has foundational modules for configuration loading, prompt management, provider registration, and workflow execution. Before adding real providers, the architecture needs an end-to-end verification path.

The verification path must avoid real APIs, secrets, publishing, and external side effects.

## Decision

Asteria will use Cat Magazine as the first dry-run magazine.

The dry run will:

- Load Cat Magazine config.
- Load and render article and SEO prompts.
- Register mock providers in `ProviderRegistry`.
- Resolve provider interfaces at the composition root.
- Build workflow steps with explicit provider dependencies.
- Execute steps through `SequentialWorkflowEngine`.
- Return a structured `DryRunResult`.
- Provide a CLI command for readable console output.

The Workflow Engine will not know about provider implementations, prompt files, magazine config paths, or CLI formatting.

## Consequences

This validates the architecture before real providers are introduced. The dry-run module creates a practical integration point for future Cat Magazine MVP work while keeping all external behavior mocked. The tradeoff is that some magazine-specific composition code now exists before shared workflow factories have been generalized.

