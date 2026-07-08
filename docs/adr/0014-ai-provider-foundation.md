# ADR 0014: AI Provider Foundation

## Context

Asteria is moving from mock dry-run generation toward real AI-backed article and SEO generation. Future AI providers may include OpenAI, Claude, Gemini, OpenRouter, and local LLMs.

Adding a real provider before a shared AI contract would risk leaking provider-specific request shapes, usage metadata, errors, and streaming behavior into workflows or magazine modules.

## Decision

Asteria will define a provider-agnostic AI Provider Foundation under `src/providers/ai`.

The foundation includes:

- AI provider interface.
- AI request model.
- AI response model.
- AI message model.
- AI model metadata shape.
- AI usage metadata.
- AI error categories.
- Deterministic Mock AI provider.

AI providers will receive rendered prompts only. They must not know about workflows, prompt files, publishers, image libraries, monetization providers, magazine configuration loading, or publishing destinations.

The mock provider will support generation, streaming shape, token counting, health checks, usage metadata, and deterministic output without network calls.

## Consequences

Future OpenAI, Claude, Gemini, OpenRouter, and local LLM adapters can implement the same boundary without changing workflow orchestration. Cat Magazine dry run now validates the AI provider path through Provider Registry and workflow steps.

The tradeoff is that the older `src/core/AIProvider` contract remains as an early lightweight interface. Future cleanup should either migrate remaining references to the provider foundation or turn the core contract into a compatibility export once real adapters prove the final shape.
