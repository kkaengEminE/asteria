# ADR 0013: Monetization Workflow Integration

## Context

Asteria has a provider-agnostic Monetization Domain and a mock-first Coupang affiliate adapter. The next architecture check is to prove that affiliate recommendations can be composed into a magazine dry run without coupling the Workflow Engine or shared dry-run result to Coupang-specific details.

The integration must not call Coupang APIs, use credentials, generate production affiliate links, or publish monetized content.

## Decision

Cat Magazine dry run will include a `Generate Monetization Preview` workflow step after SEO generation and before publish preview.

The composition root will:

- Register the mock Coupang affiliate adapter through Provider Registry.
- Resolve it as a `MonetizationProvider`.
- Pass the provider interface into Cat dry-run steps.

The workflow step will:

- Build a provider-agnostic product search query from the topic, Cat tags, category, and rating threshold.
- Request recommendations through `MonetizationProvider`.
- Collect generated affiliate links.
- Reject non-mock affiliate links during dry-run execution.
- Store generic recommendation, affiliate link, preview, and disclosure data in the workflow context.

The shared `DryRunResult` will expose generic monetization fields only. Coupang product IDs and provider-specific record shapes must remain inside the adapter or product metadata.

## Consequences

The Cat Magazine dry run now verifies the monetization path end-to-end without external APIs. The Workflow Engine remains provider-agnostic, and the Coupang adapter remains replaceable.

The tradeoff is that disclosure policy, affiliate compliance, product availability, price freshness, and editorial safety rules still need dedicated design before production monetization.
