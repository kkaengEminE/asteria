# ADR 0007: WordPress Publisher Adapter

## Context

Asteria needs publisher adapters that can be swapped without changing workflow orchestration. WordPress is the first publisher target in the roadmap, but production publishing requires credentials, API behavior, retries, and operational safeguards that should not be introduced yet.

The system needs a draft adapter shape to validate provider boundaries before real WordPress integration.

## Decision

Asteria will introduce a mock-first WordPress publisher adapter under `src/providers/publisher/wordpress`.

The adapter will:

- Implement the shared `Publisher` interface.
- Accept `PublishingPayload`.
- Map it to a WordPress-specific post payload.
- Validate required title and content fields.
- Return a structured dry-run preview result.
- Register through Provider Registry using a provider token.

The adapter will not:

- Call WordPress APIs.
- Use a WordPress SDK.
- Read or require secrets.
- Publish content.

## Consequences

Workflow code can depend on `Publisher` while the provider layer owns WordPress-specific mapping. The Cat dry run can exercise a realistic publisher adapter boundary without external side effects. Real publishing will require a later sprint for credentials, HTTP/API client boundaries, error handling, retries, and production safety controls.

