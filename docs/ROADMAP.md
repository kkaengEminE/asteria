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

Status: Foundation implemented with provider-neutral `PublishingWorkflow`, disabled-by-default publishing config, approval-required publisher access, WordPress preview adapter integration, Cat dry-run publishing gate, and tests. Real WordPress API calls, SDK usage, credentials, and production publishing remain deferred.

### Sprint 28: Gemini AI Provider Adapter

Add Gemini as an optional AIProvider adapter while MockAIProvider remains the default.

Status: Implemented with `GeminiProvider`, Gemini environment config, transport abstraction, request/response mapping, provider-neutral PublishingPackage mapping, Gemini dry-run mode selection, clear disabled/missing-key/malformed-response errors, and tests. Gemini production calls require `GEMINI_PRODUCTION_ENABLED=true` and `GEMINI_API_KEY`.

Patch status: Implemented automatic `.env` loading with exported environment precedence, `--language` CLI propagation into prompt variables and PublishingPackage metadata, improved provider-specific dry-run article labels, clearer provider config errors, and Markdown-aware article structure detection.

Patch 2 status: Implemented stricter Gemini JSON output instructions, JSON response MIME hinting, safe repair for common malformed Gemini JSON, provider/model/parse-error response previews, and tests for ko-KR malformed JSON recovery.

Patch 3 status: Implemented dry-run output consolidation so article and SEO previews use PublishingPackage as the source of truth, plus improved Korean sentence, Markdown, numbered section, and list structure detection.

### Sprint 29: Magazine Profile System

Introduce provider-neutral magazine profiles so the content generation pipeline no longer assumes Cat Magazine as the only magazine.

Status: Implemented with `MagazineProfile`, `MagazineProfileRegistry`, profile validation, Cat profile configuration, `--magazine cat` dry-run support, profile-based prompt composition inputs, backward-compatible Cat dry runs, and tests.

### Sprint 30: Magazine Template System

Introduce reusable magazine templates so multiple magazines can share common editorial configuration without duplication.

Status: Implemented with `MagazineTemplate`, `MagazineTemplateRegistry`, template validation, `blog` template configuration, profile template inheritance, override precedence, Cat profile refactor, prompt propagation, and tests.

### Sprint 31: Second Magazine Profile

Add a second magazine profile to prove MagazineTemplate and MagazineProfile reuse beyond Cat Magazine.

Status: Implemented with Dog Magazine config/profile, blog template inheritance, Dog-specific editorial values, Dog dry-run support, Dog Quality Lab support, Dog mock image/product fixtures, Cat backward compatibility, missing magazine handling, and tests. Publishing and real Google Drive remain disabled.

### Sprint 32: Magazine Runtime Extraction

Remove Cat-specific runtime naming now that multiple magazines exist.

Status: Implemented with `runMagazineDryRun`, shared `src/magazines/runtime` composition, thin Cat and Dog modules, backward-compatible Cat exports, CLI migration to the generic runtime, Quality Lab migration to the generic runtime, and Cat/Dog regression tests. Publishing and real Google Drive remain disabled.

### Sprint 33: Storage Provider Foundation

Introduce a provider-neutral storage boundary before real cloud storage integrations.

Status: Implemented with `StorageProvider`, provider-neutral file and folder models, Provider Registry `Storage` category support, LocalStorageProvider for tests and development-only file operations, and storage provider tests. Google Drive, S3, OAuth, secrets, publishing, and network calls remain deferred.

### Sprint 34: Google Drive Storage Provider

Implement Google Drive behind the provider-neutral StorageProvider boundary.

Status: Storage provider adapter implemented with `GoogleDriveStorageProvider`, environment-based safeguards, transport abstraction, Drive record mapping, upload, download, folder creation, listing, metadata lookup, Provider Registry token, and fully mocked tests. Real image-library integration, OAuth flow, SDK usage, and publishing remain deferred.

### Sprint 35: Asset Library Foundation

Introduce a provider-neutral Asset Library above StorageProvider so storage backends do not become the asset model.

Status: Implemented with Asset Domain models, AssetLibrary service, StorageProvider-backed registration and retrieval, image asset projection, Google Drive image library refactor through AssetLibrary, and tests for asset registration, lookup, metadata, image retrieval, and storage adapter integration. Publishing remains disabled.

### Sprint 36: Publishing Queue Foundation

Introduce a provider-neutral queue for approved publishing packages before future publishing execution.

Status: Implemented with Publishing Queue domain models, in-memory queue service, approval-based queue rejection, PublishingWorkflow queue integration, dry-run queue preview output, and tests. Real publishing, WordPress network execution, Coupang integration, and scheduling remain deferred.

### Sprint 37: Audit Log Foundation

Introduce a provider-neutral audit log that records important workflow and queue events before persistence, scheduler, and publishing execution work.

Status: Implemented with Audit Domain models, in-memory AuditLog service, event append/list/filter operations, ContentGenerationWorkflow integration, EditorialApproval integration, PublishingQueue integration, dry-run audit timeline output, and tests. Persistence, scheduler integration, publishing, and external logging remain deferred.

### Sprint 38: Retry Foundation

Introduce a provider-neutral retry service for recoverable operations before wider production integrations.

Status: Implemented with Retry Domain models, RetryService, max-attempt policy enforcement, fixed delay simulation, retryable/non-retryable classification, retry history, mocked workflow proof, dry-run retry metadata output, and tests. Scheduler, persistence, publishing, and production behavior changes remain deferred.

### Sprint 39: Retry Migration

Replace duplicated content generation retry logic with the shared RetryService while preserving behavior.

Status: Implemented with ContentGenerationWorkflow migration to RetryService, provider-neutral retry classification, preserved retry metadata, structured output recovery regression coverage, and tests. Scheduler, persistence, publishing, and new feature work remain deferred.

### Architecture Cleanup Patch 002

Resolve immediate reliability and architecture issues from Architecture Review 002 before starting Sprint 40.

Status: Implemented with explicit Publishing Queue transition rules, invalid transition results, queue rejection audit events, expanded architecture boundary guard, relative import cycle detection, direct domain import cleanup, and documentation refresh. No product features, persistence, publishing, scheduler, or Coupang integration were added.

### Sprint 40: Scheduler Foundation

Introduce a provider-neutral scheduler for queued publishing packages without persistence or execution.

Status: Implemented with Scheduler Domain models, in-memory SchedulerService, schedule/get/list/cancel operations, duplicate scheduling prevention, Publishing Queue `SCHEDULED` integration, `JOB_SCHEDULED` and `JOB_CANCELLED` audit events, dry-run scheduler preview output, and tests. Persistence, real scheduling execution, publishing, and external scheduler platforms remain deferred.

### Sprint 41: Scheduled Job Execution Foundation

Introduce provider-neutral execution preview for due scheduled jobs without publishing.

Status: Implemented with execution domain models, ScheduledJobExecutor, in-memory execution storage, due/future/cancelled/invalid job handling, duplicate execution prevention, RetryService integration, Publishing Queue `PROCESSING` preview transition, execution audit events, dry-run execution preview output, and tests. Real publishing, WordPress network calls, Coupang integration, persistence, and external scheduler execution remain deferred.

### Sprint 42: Real Coupang Integration

Connect the Coupang affiliate adapter to real product and affiliate link workflows.

Status: Implemented with production-capable Coupang monetization adapter, disabled-by-default environment safeguards, injectable transport, mocked test transport, RetryService integration, affiliate audit events, provider diagnostics, dry-run `--affiliate coupang` mode, and tests. MockCoupangProvider remains available. Publishing, WordPress execution, persistence, and external API calls during tests remain disabled.

### Sprint 43: Publisher Foundation

Complete the provider-neutral Publisher layer between ScheduledJobExecutor and concrete publisher adapters.

Status: Implemented with provider-neutral publisher domain models, PublisherService validation/dispatch/result normalization, DryRunPublisher deterministic preview IDs and URLs, ScheduledJobExecutor publish request integration, publish audit events, RetryService integration, dry-run publisher output, and tests. Real WordPress publishing, network calls, persistence, and production publishing remain disabled.

### Sprint 44: WordPress Publisher Adapter

Implement the provider-specific WordPress Publisher adapter behind the provider-neutral Publisher interface.

Status: Implemented with WordPressPublisher, WordPressTransport, WordPressMapper, guarded WordPress environment config, mocked transport tests, retry integration, audit integration, provider-neutral publish result mapping, legacy dry-run preview compatibility, and documentation. DryRunPublisher remains default. Production publishing, network calls, persistence, and WordPress execution remain disabled.

### Sprint 45: Metrics Foundation

Introduce provider-neutral pipeline observability before adding more production-facing integrations.

Status: Implemented with Metrics Domain models, in-memory MetricsService, counters, duration recording, failure recording, snapshots, ContentGenerationWorkflow integration, PublishingQueue integration, SchedulerService integration, ScheduledJobExecutor integration, PublisherService integration, dry-run Metrics Summary output, and tests. Persistence, external analytics, Instagram, and real publishing remain deferred.

### Sprint 46: Instagram Generation

Generate Instagram-ready captions, hashtags, and image selection metadata from article content.

Status: Implemented with provider-neutral Instagram domain models, InstagramContentService, PublishingPackage-to-social preview generation, MagazineProfile propagation, SEO keyword hashtag reuse, selected image reference metadata, dry-run Instagram Preview output, and tests. Instagram posting, Instagram API calls, OAuth, publishing, and persistence remain deferred.

### Sprint 47: Podcast / TTS

Add text-to-speech generation and podcast publishing workflows behind replaceable interfaces.

Status: Foundation implemented with provider-neutral Podcast / TTS domain models, PodcastContentService, PublishingPackage-to-audio preview generation, optional Instagram Preview hook/CTA reuse, chapter generation, duration estimation, TTS segment generation, dry-run Podcast Preview output, and tests. Real TTS APIs, audio synthesis, podcast publishing, media upload, external network calls, and persistence remain deferred.

### Architecture Cleanup Patch 003

Reduce DryRunResult growth and split dry-run runtime composition before adding more preview channels.

Status: Implemented with Architecture Review 003 documentation, provider-neutral preview aggregation primitives, `DryRunPreviewReport`, typed channel previews, section-specific dry-run CLI formatters, concern-based magazine runtime step grouping, architecture boundary guard coverage for preview domain, and regression tests. No new product features, channels, persistence, publishing, or external API calls were added.

### Sprint 48: Scheduler Operations

Strengthen provider-neutral scheduler operations without persistence, cron, external schedulers, or publishing.

Status: Implemented with reschedule, retry scheduling, invalid schedule rejection, duplicate active job detection, immutable completed scheduler jobs, scheduler operation state in dry-run output, audit events, metrics, RetryService integration, and tests. Persistence, external schedulers, cron integration, and publishing remain deferred.

### Architecture Cleanup Patch 004

Retire safe legacy contracts before persistence work.

Status: Implemented with removal of the obsolete `src/core/AIProvider` contract, provider registry test migration to the current `src/providers/ai` contract, WordPress adapter cleanup away from legacy publishing preview payload/result helpers, a provider adapter boundary guard against legacy core imports, and documentation refresh. Public CLI behavior remains unchanged. The older publishing workflow payload was deferred to Architecture Cleanup Patch 005 and has since been retired.

### Architecture Cleanup Patch 005

Retire the remaining active legacy publishing workflow contracts before persistence work.

Status: Implemented with PublishingWorkflow migration to `PublishRequest` / `PublishResult`, execution through PublisherService, DryRunPublisher-backed magazine runtime composition, removal of obsolete core Publisher and publishing payload/result contracts, dry-run publish preview compatibility, expanded architecture boundary guard coverage for publishing and scheduler services, and regression tests. Publishing remains disabled, no persistence was added, and no external API calls were introduced.

### Sprint 49: Persistence Architecture Planning

Design provider-neutral persistence architecture before adding durable storage.

Status: Planned in documentation with repository boundaries, persistence ownership, transaction policy, locking strategy, idempotency policy, migration strategy, and lifecycle design for Queue, Scheduler, Audit, Metrics, Assets, and Storage metadata. No database, SQLite, PostgreSQL, ORM, filesystem persistence, runtime behavior change, external API call, or product feature was added.

### Sprint 50: Persistence Ports Foundation

Turn the approved persistence architecture into provider-neutral TypeScript ports only.

Status: Implemented with `src/services/persistence` repository/store ports for Publishing Queue, Scheduler, Job Execution, Audit, Metrics, Asset Catalog, Storage Metadata, Idempotency, Locking, and UnitOfWork. Added shared revision, pagination, transaction, lock token, and idempotency record types plus small in-memory proof adapters for IdempotencyStore, LockManager, and UnitOfWork tests. Existing runtime services were not migrated. No database, ORM, filesystem persistence, runtime behavior change, external API call, publishing, or product feature was added.
