# ADR 0016: OpenAI Adapter

## Context

Asteria has a provider-agnostic AI Provider Foundation and a Content Domain. The next integration step is to add the first real AI provider without changing workflow, prompt, or content boundaries.

Real provider support introduces credential handling, network transport behavior, provider-specific request and response shapes, and provider-specific error semantics. Those concerns must not leak into the Workflow Engine, Content Domain, Prompt Management System, or magazine modules.

## Decision

Asteria will add an optional OpenAI adapter under `src/providers/ai/openai`.

The adapter will:

- Implement the shared `AIProvider` interface.
- Read configuration from environment variables or explicit constructor inputs only.
- Require explicit production enablement before making transport calls.
- Use an `OpenAITransport` abstraction so tests can inject mocked responses.
- Keep OpenAI request mapping, response mapping, error mapping, and health checks inside the adapter.
- Return provider-neutral `AIResponse`, `AIUsage`, and `AIProviderError` values.

`MockAIProvider` remains the default provider for dry runs and tests. The Workflow Engine continues to depend only on registered workflow steps, and workflow composition continues to resolve providers through the Provider Registry.

## Consequences

Asteria can now support a real AI provider boundary without requiring credentials for local development, dry runs, or automated tests.

Future real article and SEO generation can opt into OpenAI through composition while preserving the option to replace it with Claude, Gemini, OpenRouter, or local LLM providers.

The tradeoff is that production usage still needs a guarded composition layer, secret management, operational retry policy, and parsing from AI responses into `ContentGenerationResult`.
