# ADR 0004: Provider Registry

## Context

Asteria will use many replaceable external providers, including AI, research, publishing, image library, affiliate, TTS, podcast, and analytics providers.

If workflows instantiate concrete providers directly, provider choice, testing, dry-run behavior, and future replacement become harder to manage. At the same time, a global service locator would hide dependencies and make modules harder to reason about.

## Decision

Asteria will use a Provider Registry at the application composition boundary.

The registry will:

- Register providers by typed tokens.
- Support provider categories.
- Resolve providers through factories.
- Detect duplicate registration.
- Report unknown providers.
- Support removal and listing.

The Workflow Engine will never instantiate or resolve providers directly. Workflow factories or application composition code may resolve provider interfaces and inject them into workflow steps.

## Consequences

Provider lifecycle and lookup have a single foundation without coupling the Workflow Engine to concrete integrations. Tests can register mock providers. The registry must not become a hidden global dependency; dependencies should remain explicit once workflow steps are constructed.

