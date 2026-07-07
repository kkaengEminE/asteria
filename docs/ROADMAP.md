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

## Phase 6.5: Image Asset Domain

Define the storage-agnostic image model that all future image providers must support.

Status: Implemented with image asset metadata, tags, categories, search query, selection criteria, scoring helpers, validation, and tests. Google Drive, S3, local storage, and Cloudinary remain future adapters.

## Phase 7: Google Drive Image Library

Implement an image library adapter for curated assets stored in Google Drive.

Status: Draft implemented with local mock metadata records, ImageAsset mapping, search, find, random, score, select, Provider Registry token, and tests. Google APIs, OAuth, SDK usage, secrets, and real Drive access remain deferred.

## Phase 7.5: Image Selection Workflow Integration

Integrate the mock image library into Cat Magazine dry run.

Status: Implemented with mock image provider registration, Select Image workflow step, topic/tag/category/rating/favorite-based selection, selected image preview in DryRunResult, CLI output, and tests. No real image storage access is used.

## Phase 8: Coupang Affiliate

Implement an affiliate provider adapter for Coupang while keeping affiliate enrichment optional per magazine.

Status: Draft implemented with local mock Coupang-style records, Product domain mapping, ranked recommendations, mock affiliate link generation, Provider Registry token, and tests. Coupang APIs, SDK usage, secrets, production links, and monetized publishing remain deferred.

## Phase 8.5: Monetization Workflow Integration

Integrate mock affiliate recommendations into Cat Magazine dry run.

Status: Implemented with mock Coupang provider registration, Generate Monetization Preview workflow step, topic/tag/category/relevance-based recommendations, generic recommended product and affiliate link fields in DryRunResult, CLI output, and tests. All links remain `mock://`; no monetized content is published.

## Phase 8.0: Monetization Domain

Define the provider-agnostic product, affiliate link, recommendation, and monetization result model that all future affiliate providers must support.

Status: Implemented with product metadata, search query, recommendation model, recommendation reasons, mock affiliate link generation, mock monetization provider, preview results, Provider Registry compatibility, and tests. Coupang, Amazon, Temu, affiliate APIs, secrets, and external calls remain future adapters.

## Phase 9: Instagram Content Generator

Generate Instagram-ready captions, hashtags, and image selection metadata from article content.

## Phase 10: TTS + Podcast

Add text-to-speech generation and podcast publishing workflows behind replaceable interfaces.

## Phase 11: Analytics

Collect publication and performance analytics through provider adapters and feed results into future editorial planning.
