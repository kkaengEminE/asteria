# ADR 0009: Google Drive Image Library Adapter

## Context

Asteria needs an image library adapter for curated assets that may eventually live in Google Drive. The Image Asset Domain already defines the storage-agnostic model that workflows should use.

Real Google Drive integration would require OAuth, credentials, API clients, pagination, rate-limit handling, permissions, and operational safeguards. Those concerns should not enter the system yet.

## Decision

Asteria will introduce a mock-first Google Drive image library adapter under `src/providers/image/googleDrive`.

The adapter will:

- Use local mock metadata records only.
- Keep Google Drive-shaped fields inside adapter records.
- Map records into domain `ImageAsset` values.
- Implement search, find, random, score, and select behavior.
- Register through Provider Registry using an image provider token.

The adapter will not:

- Call Google APIs.
- Use a Google SDK.
- Implement OAuth.
- Read or require secrets.
- Access real Google Drive files.

## Consequences

Workflow and selection code can depend on storage-agnostic image domain objects while the provider layer owns Google Drive-specific mapping. Tests can verify provider registration and image selection without external side effects. Real Google Drive support will require a later sprint for authentication, API boundaries, synchronization, permission handling, and production safety.

