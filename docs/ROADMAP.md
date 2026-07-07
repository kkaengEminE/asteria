# Roadmap

## Phase 1: Core Interfaces

Define stable contracts for providers, generators, publishers, workflow steps, and magazine configuration.

## Phase 2: Config Loader

Load magazine configs from disk, validate required fields, and expose typed configuration to workflows.

## Phase 3: Prompt Manager

Create prompt set loading, prompt variable interpolation, and prompt version tracking.

Status: Foundation implemented with markdown prompt loading, registration, lookup, variable interpolation, validation, and shared-to-magazine override behavior. Prompt version tracking is deferred until real prompt lifecycle needs appear.

## Phase 4: Provider Registry

Manage provider registration, lookup, categories, and factory boundaries before real provider integrations.

Status: Foundation implemented with provider tokens, categories, factories, context, registry operations, and mock-provider tests.

## Phase 5: Cat Magazine MVP

Build the first end-to-end dry-run magazine flow using Cat Magazine configuration.

Status: Dry-run MVP implemented with config loading, prompt rendering, mock provider resolution, shared dry-run workflow factory usage, sequential workflow execution, generated mock article, SEO preview, publish preview, CLI output, and tests. No real providers are used.

## Phase 5.5: Shared Dry-Run Workflow Foundation

Extract reusable dry-run workflow construction and result shaping from Cat Magazine without generalizing unproven magazine-specific behavior.

Status: Implemented with `src/services/dryRun`, shared dry-run result type, step helper utilities, workflow factory, Cat dry-run refactor, and regression tests.

## Phase 6: WordPress Publisher

Implement a WordPress publisher adapter behind the `Publisher` interface.

Status: Draft implemented with local payload validation, Provider Registry token, dry-run preview result, Cat dry-run registration, and tests. Real API calls, secrets, SDK usage, and production publishing remain deferred.

## Phase 7: Google Drive Image Library

Implement an image library adapter for curated assets stored in Google Drive.

## Phase 8: Coupang Affiliate

Implement an affiliate provider adapter for Coupang while keeping affiliate enrichment optional per magazine.

## Phase 9: Instagram Content Generator

Generate Instagram-ready captions, hashtags, and image selection metadata from article content.

## Phase 10: TTS + Podcast

Add text-to-speech generation and podcast publishing workflows behind replaceable interfaces.

## Phase 11: Analytics

Collect publication and performance analytics through provider adapters and feed results into future editorial planning.
