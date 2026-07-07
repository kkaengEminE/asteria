# ADR 0003: Prompt Management

## Context

Asteria will use AI providers across multiple magazines and channels. Hardcoded prompt strings inside providers, services, or workflows would make prompts difficult to review, override, test, and reuse.

Magazine-specific prompt needs should not require provider-specific code.

## Decision

Asteria will treat prompts as first-class file assets.

Prompt assets live under:

- `prompts/shared`
- `prompts/magazines/{slug}`

Prompt management code lives under `src/prompts` and is responsible for loading, registering, looking up, validating, and rendering prompts.

Shared prompts load first. Magazine prompts load second and override shared prompts with the same key.

## Consequences

AI provider integrations can consume rendered prompt text without owning prompt logic. Magazine-specific prompt customization remains file-based and reviewable. The current implementation keeps the prompt format simple markdown and defers versioning until prompt lifecycle requirements are clearer.

