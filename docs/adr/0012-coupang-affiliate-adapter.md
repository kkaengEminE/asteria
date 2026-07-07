# ADR 0012: Coupang Affiliate Adapter Draft

## Context

Asteria now has a provider-agnostic Monetization Domain. The next step is to prove that an affiliate-specific provider can map its own product records into the shared domain model without leaking provider details into workflows or domain objects.

Coupang Partners is a likely future affiliate integration, but real API calls, credentials, SDKs, production links, and monetized publishing are not safe to introduce before the adapter boundary is tested.

## Decision

Asteria will add a mock-first Coupang affiliate adapter under `src/providers/monetization/coupang`.

The adapter will:

- Accept local mock Coupang-style product records.
- Validate dry-run-only configuration.
- Map Coupang records into domain `Product` values.
- Implement the shared `MonetizationProvider` interface.
- Support product search, ranked recommendations, mock affiliate link generation, and preview creation.
- Register through a typed Provider Registry token in the `Affiliate` category.

The adapter will not call Coupang APIs, use a Coupang SDK, store secrets, generate production affiliate links, or publish monetized content.

## Consequences

Asteria can now test an affiliate-specific adapter shape while preserving the Monetization Domain boundary. Future Coupang API work can replace mock records inside the adapter without changing workflows or domain models.

The tradeoff is that compliance rules, disclosure placement, product availability, commission metadata, tracking IDs, and real product freshness remain unresolved and need explicit future design before production monetization.
