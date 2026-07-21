# ADR 0007: WordPress Publisher Adapter

## Status

Deprecated and inactive for Asteria v1 as of 2026-07-21. The adapter is retained, not deleted. Astro + Cloudflare Pages is the active public path, and automatic public publishing remains prohibited.

## Context

Asteria needs publisher adapters that can be swapped without changing workflow orchestration. WordPress is the first publisher target in the roadmap. The original decision introduced a mock-first adapter; WordPress Integration 001 extends that boundary with a production REST transport while retaining draft-only behavior.

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

The production transport now:

- Calls WordPress REST API endpoints using a dedicated user's Application Password.
- Resolves or creates categories and tags and submits their numeric IDs with the post.
- Optionally attaches an existing WordPress Media Library ID as featured media.
- Retries network failures and transient HTTP responses while reporting structured failures.
- Forces `draft` in the mapper and transport and rejects any non-draft attempt.

The adapter does not publish content. Public publishing remains a manual action by an authorized human in WordPress.

## Consequences

Workflow code can depend on `Publisher` while the provider layer owns WordPress-specific mapping. The REST transport is production-capable for draft creation. The approval gates, explicit environment flags, least-privilege credentials, and manual WordPress publishing remain mandatory.
