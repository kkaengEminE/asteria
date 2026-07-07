# ADR 0011: Monetization Domain

## Context

Asteria will eventually support affiliate monetization for magazine content. Future providers may include affiliate networks or commerce partners, but introducing provider-specific concepts too early would leak implementation details into workflows and content generation.

Before adding a real affiliate adapter, Asteria needs a provider-agnostic monetization model.

## Decision

Asteria will define the Monetization Domain under `src/domain/monetization`.

The domain will include:

- Product metadata.
- Product search query.
- Recommendation reason.
- Recommendation model.
- Affiliate link model.
- Monetization result and preview.
- Monetization provider interface.
- Mock monetization provider for tests and dry-run style behavior.

The monetization domain will not know about Coupang, Amazon, Temu, affiliate APIs, tracking credentials, commission rules, or provider SDKs.

## Consequences

Future affiliate providers can adapt their product catalogs and link generation into a shared model before workflows consume recommendations. Monetization logic remains testable without external APIs. The tradeoff is that real provider-specific features such as tracking IDs, commission categories, and disclosure rules will need explicit adapter and policy design later.

