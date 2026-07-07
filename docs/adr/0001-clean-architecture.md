# ADR 0001: Clean Architecture

## Context

Asteria is intended to run multiple magazines and multiple automation channels from one codebase. Future integrations will include AI providers, research providers, image libraries, publishers, affiliate systems, TTS systems, podcast publishers, and analytics providers.

If provider-specific logic leaks into domain models or workflow orchestration, the system will become difficult to test, replace, and extend.

## Decision

Asteria will follow clean architecture principles:

- Core contracts define what the system needs.
- Domain concepts stay independent from infrastructure.
- Provider adapters implement interfaces.
- Services compose provider interfaces into application behavior.
- Workflows coordinate steps and do not depend on concrete providers.

## Consequences

Provider replacement remains straightforward, and tests can use mock implementations. The tradeoff is that early development requires slightly more interface design before concrete features appear.

