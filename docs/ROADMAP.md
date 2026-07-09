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

## Next Sprint Sequence

### Sprint 15: AI Provider Foundation

Define provider-agnostic AI contracts before real AI integrations.

Status: Implemented with AI request, response, message, model, usage, error, health check, token counting, streaming interface, deterministic Mock AI provider, Provider Registry compatibility, Cat dry-run integration, and tests. No real AI APIs are called.

### Sprint 16: Content Domain Foundation

Define the canonical content model that every future AI provider must produce.

Status: Implemented with Article, ArticleMetadata, ArticleSection, SEO, FAQ, Category, Tag, ContentStatus, ContentGenerationResult, validation helpers, slug generation, metadata normalization, and tests. No real AI APIs are called.

### Sprint 17: OpenAI Adapter

Implement the first real AI provider adapter behind the AI provider foundation.

Status: Implemented with an optional OpenAI provider, environment-based configuration, injectable transport abstraction, provider-neutral response and error mapping, Provider Registry compatibility, and mocked tests. Production calls are disabled by default, and the Cat dry run continues to use MockAIProvider.

### Sprint 18: Content Generation Pipeline

Create a provider-agnostic pipeline that turns a topic into a complete publishing package while preserving dry-run safeguards.

Status: Implemented with `ContentGenerationWorkflow`, `ContentRequest`, `PublishingPackage`, summary, SEO metadata, FAQ item, image prompt, and product prompt models. MockAIProvider generates deterministic dry-run packages, OpenAIProvider maps AI JSON output into the same domain model through its adapter, and `npm run dry-run` prints the assembled package. No publishing is implemented.

### Sprint 19: Structured AI Output

Harden the AI output layer so content generation can recover from malformed output before production usage.

Status: Implemented with `StructuredOutputParser`, `StructuredOutputValidator`, `StructuredOutputError`, configurable retry handling in `ContentGenerationWorkflow`, prompt version metadata, normalization of whitespace and duplicate FAQ items, and dry-run output for prompt version, retry count, validation result, and generation duration. Publishing remains disabled.

### Sprint 20: Prompt Asset System

Separate prompt definitions from workflow logic with versioned prompt assets.

Status: Implemented with `PromptAssetRegistry`, prompt asset models, explicit and latest version resolution, template variable rendering, prompt metadata exposure, content prompt assets for article, summary, SEO, FAQ, image prompt, and product prompt, and dry-run display of prompt id, version, rendered variables, and rendered prompt preview.

### Sprint 21: Production AI Integration

Connect the Prompt Asset System and Structured Output Pipeline to production-enabled OpenAI generation while preserving mock-first dry runs.

Status: Implemented with explicit Cat dry-run AI mode selection, default MockAIProvider behavior, OpenAI production safeguards, missing API key errors, rendered prompt asset propagation into OpenAIProvider, provider/model/token usage metadata, and structured output validation on the OpenAI generation path. Publishing remains disabled.

### Sprint 22: Content Quality Pipeline

Improve generated publishing package quality through prompt composition, prompt profiles, provider-neutral quality validation, quality scoring, and richer dry-run review output.

Status: Implemented with composed prompt stacks, `default`/`blog`/`magazine` prompt profiles, content quality validation, 0-100 quality scoring, quality metadata propagation, and dry-run output for prompt profile, prompt stack, composed prompt preview, validation report, and quality report. Publishing remains disabled.

### Sprint 23: Editorial Review Layer

Introduce a provider-neutral editorial review layer that evaluates generated publishing packages before future publication readiness decisions.

Status: Implemented with Editorial Review Domain models, `EditorialReviewService`, review result classification, issue category/severity/recommendation output, separate 0-100 review score, ContentGenerationWorkflow metadata integration, and dry-run display of review summary and issues. Publishing remains disabled.

### Sprint 24: Real AI Content Generation

Generate complete publishing packages through production-enabled OpenAI while preserving provider-neutral content, quality, and editorial review boundaries.

Status: Implemented with prompt-driven OpenAI publishing package generation, fenced JSON recovery, response text extraction, common AI field alias normalization, complete PublishingPackage mapping, token usage metadata propagation, structured output validation, quality scoring, editorial review metadata, and mock-first dry-run compatibility. Publishing remains disabled.

### Sprint 25: Real Article and SEO Review

Use production-enabled AI generation to tune real article and SEO output quality through the existing Content Generation Pipeline and review metadata.

Status: Implemented with `RealGenerationReviewService`, configurable review-only thresholds, article word and character counts, SEO completeness checks, article structure review, FAQ usefulness review, summary usefulness review, threshold result metadata, dry-run display, and tests. Publishing remains disabled.

### Sprint 26: Editorial Approval Gate

Determine whether a generated PublishingPackage is ready for future publishing without publishing anything.

Status: Implemented with Approval Domain models, `EditorialApprovalService`, `APPROVED` / `NEEDS_REVIEW` / `REJECTED` decisions, structured approval reasons, recommendations, blocking issues, non-blocking issues, ContentGenerationWorkflow metadata integration, dry-run display, and tests. Publishing remains disabled.

### Sprint 27: Real WordPress Publishing

Replace WordPress dry-run preview with guarded production publishing.

### Sprint 28: Real Google Drive Integration

Connect the Google Drive image library adapter to real Drive metadata and assets.

### Sprint 29: Real Coupang Integration

Connect the Coupang affiliate adapter to real product and affiliate link workflows.

### Sprint 30: Instagram Generation

Generate Instagram-ready captions, hashtags, and image selection metadata from article content.

### Sprint 31: Podcast / TTS

Add text-to-speech generation and podcast publishing workflows behind replaceable interfaces.

### Sprint 32: Scheduler

Enable real GitHub Actions scheduling only after real integrations have production safeguards.
