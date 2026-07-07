# ADR 0010: Image Selection Workflow

## Context

Asteria now has a storage-agnostic Image Asset Domain and a mock-first Google Drive image library adapter. The Cat Magazine dry run can verify that image providers work in the same provider-registry and workflow pattern as research, AI, and publishing.

This integration must not introduce real Google Drive access, OAuth, secrets, or provider-specific logic into the Workflow Engine.

## Decision

Cat Magazine dry run will include a `Select Image` workflow step.

The composition root will:

- Register the mock Google Drive image library through Provider Registry.
- Resolve the image library at composition time.
- Pass the image library interface into Cat dry-run steps.

The workflow step will:

- Build image criteria from the topic and Cat Magazine preferences.
- Search mock image records through the image library.
- Score and select a domain `ImageAsset`.
- Store generic image preview details in `DryRunResult`.

The generic dry-run result will expose filename, tags, category, score, and preview URI. Google Drive file IDs and provider-specific records must not become generic workflow result fields.

## Consequences

The Cat dry run now verifies the image path end-to-end without external APIs. The Workflow Engine remains provider-agnostic, and Google Drive details remain inside the adapter or source metadata. Future real image provider work can replace mock records without changing the workflow engine.

