# Module Design

This document defines the intended module responsibilities for the AI Publishing OS foundation.

## `src/core`

Contains system contracts:

- `AIProvider`
- `ResearchProvider`
- `ContentGenerator`
- `ImageLibrary`
- `ImageSelector`
- `Publisher`
- `AffiliateProvider`
- `TTSProvider`
- `PodcastPublisher`
- `AnalyticsProvider`
- `WorkflowStep`
- `WorkflowEngine`
- `MagazineConfig`

These files should remain implementation-free.

## `src/domain`

Holds domain types that describe magazine publishing concepts. Future candidates:

- Article
- EditorialPlan
- ImageAsset
- PublishingDestination
- AffiliateLink
- PodcastEpisode
- AnalyticsSnapshot

Current content domain foundation:

- `domain/content/Article`
- `domain/content/ArticleMetadata`
- `domain/content/ArticleSection`
- `domain/content/SEO`
- `domain/content/FAQ`
- `domain/content/Category`
- `domain/content/Tag`
- `domain/content/ContentGenerationResult`
- `domain/content/ContentStatus`
- `domain/content/ContentRequest`
- `domain/content/PublishingPackage`
- `domain/content/Summary`
- `domain/content/SeoMetadata`
- `domain/content/FaqItem`
- `domain/content/ImagePrompt`
- `domain/content/ProductPrompt`

The content domain defines canonical generated content models, publishing package models, and validation helpers. It does not know about OpenAI, prompt files, workflows, WordPress, or publishing adapters.

Current image domain foundation:

- `domain/image/ImageAsset`
- `domain/image/ImageMetadata`
- `domain/image/ImageTag`
- `domain/image/ImageCategory`
- `domain/image/ImageSelectionCriteria`
- `domain/image/ImageSearchQuery`
- `domain/image/ImageScore`

The image domain defines storage-agnostic image metadata, filtering, search matching, scoring, and selection helpers. It does not know about Google Drive, S3, local file systems, or Cloudinary.

Current monetization domain foundation:

- `domain/monetization/Product`
- `domain/monetization/AffiliateLink`
- `domain/monetization/Recommendation`
- `domain/monetization/RecommendationReason`
- `domain/monetization/ProductSearchQuery`
- `domain/monetization/MonetizationResult`
- `domain/monetization/MonetizationProvider`

The monetization domain defines provider-agnostic products, recommendations, affiliate links, preview results, and a mock provider. It does not know about Coupang, Amazon, Temu, or affiliate APIs.

Current editorial review domain foundation:

- `domain/editorialReview/EditorialReview`
- `domain/editorialReview/ReviewResult`
- `domain/editorialReview/ReviewIssue`
- `domain/editorialReview/ReviewSeverity`
- `domain/editorialReview/ReviewCategory`

The editorial review domain defines provider-neutral review output for generated publishing packages. It captures review result, score, summary, issue category, issue severity, message, and recommendation. It does not know about AI providers, publishers, or workflow execution.

Current approval domain foundation:

- `domain/approval/ApprovalDecision`
- `domain/approval/ApprovalStatus`
- `domain/approval/ApprovalReason`
- `domain/approval/ApprovalResult`

The approval domain defines provider-neutral readiness output. It captures approval decision, status, reasons, recommendations, blocking issues, and non-blocking issues. It does not publish and does not know about WordPress.

Current magazine profile domain foundation:

- `domain/magazineProfile/MagazineProfile`
- `domain/magazineProfile/MagazineProfileRegistry`
- `domain/magazineProfile/validateMagazineProfile`

The magazine profile domain defines provider-neutral editorial identity and policy inputs for a magazine. Profiles include id, name, language, audience, persona, tone, style, SEO policy, image style, affiliate policy, and categories. The domain does not know about providers, workflows, prompt files, or publishing adapters.

Current magazine template domain foundation:

- `domain/magazineTemplate/MagazineTemplate`
- `domain/magazineTemplate/MagazineTemplateRegistry`
- `domain/magazineTemplate/validateMagazineTemplate`

The magazine template domain defines reusable editorial defaults for multiple magazines. Templates include persona, tone, prompt profile, SEO policy, review policy, image policy, and affiliate policy. Profiles may extend templates and override specific fields; the profile registry resolves inheritance before workflows consume the profile.

Current storage domain foundation:

- `domain/storage/StorageProvider`
- `domain/storage/StorageFile`
- `domain/storage/StorageFileMetadata`
- `domain/storage/StorageFolder`

The storage domain defines provider-neutral file and folder operations for future storage-backed workflows. It does not know about Google Drive, S3, local file systems, image libraries, or publishing destinations.

Current asset domain foundation:

- `domain/asset/Asset`
- `domain/asset/AssetFile`
- `domain/asset/AssetRegistration`

The asset domain defines provider-neutral asset metadata, tags, category, MIME type, size, and storage references. It does not know about Google Drive SDK records, local paths, image scoring, or publishing workflows.

Current publishing queue domain foundation:

- `domain/publishingQueue/PublishingQueueItem`
- `domain/publishingQueue/PublishingQueueStatus`
- `domain/publishingQueue/PublishingQueueResult`
- `domain/publishingQueue/PublishingQueueFailure`
- `domain/publishingQueue/PublishingDestination`

The publishing queue domain defines provider-neutral queue items and status metadata for approved publishing packages. It does not know about WordPress, scheduler infrastructure, publisher adapters, or network execution.

Current scheduler domain foundation:

- `domain/scheduler/ScheduledJob`
- `domain/scheduler/SchedulePolicy`
- `domain/scheduler/ScheduleResult`
- `domain/scheduler/ScheduleStatus`
- `domain/scheduler/ScheduledJobExecution`
- `domain/scheduler/JobExecutionStatus`
- `domain/scheduler/JobExecutionResult`
- `domain/scheduler/JobExecutionFailure`

The scheduler domain defines provider-neutral scheduled job and execution metadata for queue items. It does not know about GitHub Actions, cron services, WordPress, publisher adapters, persistence, or network execution.

Current audit domain foundation:

- `domain/audit/AuditEvent`
- `domain/audit/AuditEventType`
- `domain/audit/AuditActor`
- `domain/audit/AuditContext`

The audit domain defines provider-neutral event records for important workflow and queue activity. It does not know about persistence, external log platforms, schedulers, publishers, provider SDKs, or network execution.

Current retry domain foundation:

- `domain/retry/RetryPolicy`
- `domain/retry/RetryAttempt`
- `domain/retry/RetryResult`
- `domain/retry/RetryReason`

The retry domain defines provider-neutral retry policy, attempt history, results, and reasons. It does not know about AI providers, storage providers, publisher adapters, schedulers, network clients, or real waiting.

## `src/providers`

Contains adapters for external systems. Future providers should be added behind interfaces, for example:

- `providers/ai/openai`
- `providers/image/googleDrive`
- `providers/publisher/wordpress`
- `providers/storage/googleDrive`
- `providers/monetization/coupang`
- `providers/social/instagram`
- `providers/audio/tts`
- `providers/analytics`

Current provider registry foundation:

- `ProviderToken`
- `ProviderContext`
- `ProviderFactory`
- `ProviderRegistry`

The registry supports provider registration, resolution, duplicate protection, lookup, removal, and category-filtered listing. Only mock providers should be used until real provider adapter sprints begin.

Current AI provider foundation:

- `providers/ai/AIProvider`
- `providers/ai/AIRequest`
- `providers/ai/AIResponse`
- `providers/ai/AIMessage`
- `providers/ai/AIModel`
- `providers/ai/AIUsage`
- `providers/ai/AIError`
- `providers/ai/MockAIProvider`

The AI provider foundation defines provider-agnostic generation contracts, usage metadata, health checks, token counting, streaming shape, and structured error categories. The mock provider is deterministic and makes no external calls.

AI providers also expose `generatePublishingPackage(ContentRequest)` for the content generation pipeline. Implementations must return the provider-neutral `PublishingPackage` domain model. MockAIProvider returns a deterministic dry-run package, and OpenAIProvider maps mocked or real AI JSON output into the same domain model.

Current OpenAI adapter:

- `providers/ai/openai/OpenAIProvider`
- `providers/ai/openai/OpenAIConfig`
- `providers/ai/openai/OpenAITransport`
- `providers/ai/openai/OpenAIMapper`

The OpenAI adapter implements `AIProvider` without becoming the default provider. It reads environment-based configuration, requires explicit production enablement before transport calls, maps OpenAI-shaped responses into provider-neutral `AIResponse` values, and supports mocked transports for tests.

For publishing package generation, OpenAIProvider consumes rendered prompt asset text from `ContentRequest.metadata`, calls the transport only when production safeguards pass, maps real OpenAI JSON output into `PublishingPackage`, and attaches provider, model, usage, and response metadata for workflow inspection. The mapper recovers fenced JSON, ignores surrounding explanation text, and normalizes common AI field aliases such as `meta_title`, `faqs`, `image_search_prompt`, and `product_recommendation_prompt`.

Current Gemini adapter:

- `providers/ai/gemini/GeminiProvider`
- `providers/ai/gemini/GeminiConfig`
- `providers/ai/gemini/GeminiTransport`
- `providers/ai/gemini/GeminiMapper`

The Gemini adapter implements `AIProvider` without becoming the default provider. It reads environment-based configuration, requires explicit production enablement before transport calls, maps Gemini candidate responses into provider-neutral `AIResponse` values, and supports mocked transports for tests.

For publishing package generation, GeminiProvider consumes rendered prompt asset text from `ContentRequest.metadata`, calls the transport only when Gemini safeguards pass, maps Gemini JSON output into `PublishingPackage`, and attaches provider, model, usage, and finish reason metadata for workflow inspection. Gemini-specific API paths, request bodies, response candidates, and errors stay inside the adapter.

GeminiMapper strengthens publishing-package requests with strict JSON-only instructions, requests JSON MIME output when possible, extracts JSON from fenced or surrounded text, and applies limited repair for raw newlines, unescaped quotes, and unterminated trailing strings. If parsing still fails, GeminiProvider returns a clear provider/model/parse-error message with a truncated raw response preview.

Current publisher adapter draft:

- `providers/publisher/wordpress/WordPressPublisher`
- `providers/publisher/wordpress/WordPressPublisherConfig`
- `providers/publisher/wordpress/WordPressPostPayload`
- `providers/publisher/wordpress/WordPressPublishResult`

The WordPress adapter implements `Publisher` and returns dry-run preview results only. It performs local validation and does not call WordPress APIs.

Current image adapter draft:

- `providers/image/googleDrive/GoogleDriveImageLibrary`
- `providers/image/googleDrive/GoogleDriveImageLibraryConfig`
- `providers/image/googleDrive/GoogleDriveImageRecord`

The Google Drive image library adapter implements the domain image library behavior with local mock records only. It maps Google Drive-shaped metadata into `ImageAsset` and supports search, find, random, score, and select without Google APIs.

Current monetization adapter draft:

- `providers/monetization/coupang/CoupangAffiliateProvider`
- `providers/monetization/coupang/CoupangAffiliateConfig`
- `providers/monetization/coupang/CoupangProductRecord`
- `providers/monetization/coupang/CoupangAffiliateLinkResult`

The Coupang affiliate adapter implements `MonetizationProvider` with local mock records only. It maps Coupang-shaped product metadata into `Product`, supports product search, ranked recommendations, mock affiliate link generation, and preview creation without Coupang APIs.

Current storage provider foundation:

- `providers/storage/local/LocalStorageProvider`
- `providers/storage/local/LocalStorageProviderConfig`
- `providers/storage/googleDrive/GoogleDriveStorageProvider`
- `providers/storage/googleDrive/GoogleDriveStorageProviderConfig`
- `providers/storage/googleDrive/GoogleDriveStorageTransport`
- `providers/storage/googleDrive/GoogleDriveStorageMapper`

The LocalStorageProvider implements the shared `StorageProvider` interface for tests and local development. It supports upload, download, file listing, folder creation, and metadata lookup under an explicit root directory. It does not call cloud APIs and is not used for production publishing.

The Google Drive StorageProvider implements the same storage interface through a transport abstraction. It supports upload, download, folder creation, file listing, and metadata lookup while keeping Drive-specific records, query strings, IDs, and response parsing inside the adapter. It is disabled by default and requires explicit Google Drive environment configuration before transport calls are allowed.

## `src/services`

Contains reusable application services that do not know about specific magazines or vendors.

Future services:

- Config loader
- Prompt manager
- Editorial planner
- Draft generator
- Image resolver
- Affiliate linker
- Publishing coordinator
- Analytics collector

Current dry-run service foundation:

- `DryRunResult`
- `DryRunStepFactory`
- `DryRunWorkflowFactory`

The dry-run services provide shared workflow construction, workflow execution, step helper utilities, and dry-run result shaping. They include generic image and monetization preview fields, but do not know about Cat Magazine prompts or provider implementations.

Dry-run CLI rendering prefers `PublishingPackage` article and SEO data over legacy article/SEO preview fields. This keeps real provider output, summaries, FAQ, SEO metadata, and package metadata aligned in one visible report.

Current structured output service foundation:

- `StructuredOutputParser`
- `StructuredOutputValidator`
- `StructuredOutputError`

The structured output layer validates required `PublishingPackage` sections, normalizes whitespace and duplicate FAQ items, extracts fenced JSON when possible, reports descriptive validation errors, and marks recoverable output failures for workflow retry. It operates on provider-neutral content models only.

Current content quality service foundation:

- `ContentQualityValidator`

The content quality service evaluates provider-neutral `PublishingPackage` values for completeness, minimum article length, summary length, duplicate FAQ entries, missing SEO fields, and empty sections. It returns a validation report and simple 0-100 quality score for workflow metadata and dry-run review.

Current editorial review service foundation:

- `EditorialReviewService`

The editorial review service evaluates provider-neutral `PublishingPackage` values for editorial readiness. It reviews completeness, readability, SEO coverage, duplicate FAQ entries, missing metadata, title quality, and summary quality. It returns a structured review report with `PASS`, `WARNING`, or `FAIL`, a separate 0-100 review score, and actionable issue recommendations.

Current real generation review service foundation:

- `RealGenerationReviewService`

The real generation review service evaluates generated `PublishingPackage` values against configurable review-only thresholds. It compares quality score, editorial review score, article length, required SEO fields, article structure, FAQ usefulness, and summary usefulness. It returns article title, word count, character count, SEO title, SEO description, FAQ count, threshold result, threshold issues, and the thresholds used. It does not publish or block publishing.

Article structure detection treats Markdown headings, bullet lists, numbered lists, and blank-line paragraphs as structure blocks. This keeps well-formed Markdown articles from being incorrectly flagged as single-paragraph output.

Current editorial approval service foundation:

- `EditorialApprovalService`

The editorial approval service evaluates validation result, content quality report, editorial review, and real generation review. It returns `APPROVED`, `NEEDS_REVIEW`, or `REJECTED` with structured reasons, recommendations, blocking issues, and non-blocking issues. It is an approval metadata layer only and does not publish.

Current publishing workflow foundation:

- `PublishingWorkflow`
- `PublishingWorkflowConfig`

The publishing workflow is provider-neutral. It requires `APPROVED` approval metadata before invoking a `Publisher`, maps `PublishingPackage` values into `PublishingPayload`, returns skipped results when publishing is disabled or approval is missing, and keeps dry-run preview behavior separate from real publishing enablement. When a Publishing Queue is injected, it creates a queue result instead of invoking a publisher adapter.

Current publishing queue foundation:

- `PublishingQueue`
- `InMemoryPublishingQueueStorage`

The Publishing Queue service supports enqueue, item lookup, item listing, guarded status updates, cancellation, and failure recording. It enforces provider-neutral queue transition rules, rejects invalid transitions with clear results, audits queue rejections, uses in-memory storage for this foundation sprint, and keeps persistence replaceable behind a queue storage boundary.

Current scheduler service foundation:

- `SchedulerService`
- `InMemorySchedulerStorage`
- `ScheduledJobExecutor`
- `InMemoryScheduledJobExecutionStorage`

The Scheduler service supports scheduling approved queue items, preventing duplicate active schedules, retrieving jobs, listing jobs, and cancelling jobs. It updates the Publishing Queue to `SCHEDULED`, records scheduler audit events, uses in-memory storage, and does not execute publishing.

The Scheduled Job Executor supports due checks, execution preview, success recording, failure recording, duplicate execution prevention, skipped invalid jobs, RetryService integration, audit events, and queue transition to `PROCESSING`. It receives a provider-neutral operation from composition and does not import or invoke publisher adapters.

Current audit log foundation:

- `AuditLog`
- `InMemoryAuditLogStorage`

The Audit Log service supports appending events, listing timeline events, filtering by entity, and filtering by event type. Content generation, editorial approval, and publishing queue services can receive an audit log instance through composition. Audit storage is in-memory for this foundation sprint and should later be replaceable through an AuditStore-style port.

Current retry service foundation:

- `RetryService`

The Retry Service executes a generic operation with configurable max attempts, fixed delay metadata, retryable/non-retryable error classification, and retry history. It simulates delay without sleeping in tests. Future AI, storage, publisher, and scheduler integrations may opt into this service through composition.

Current asset library foundation:

- `AssetLibrary`
- `mapAssetToImageAsset`

The Asset Library service uses a `StorageProvider` internally to upload, download, and look up file metadata. Callers register assets and retrieve asset metadata or image-domain projections without receiving the storage provider itself.

The Google Drive image library adapter now registers mock image records through Asset Library and then exposes image-domain `ImageAsset` values for dry-run selection. This keeps Google Drive as a storage/provider detail rather than the asset model.

## `src/prompts`

Contains prompt management logic:

- `PromptLoader`
- `PromptRegistry`
- `PromptAssetRegistry`
- `PromptAsset`
- `PromptComposer`
- `PromptDefinition`
- `PromptMetadata`
- `PromptId`
- `PromptProfile`
- `PromptTemplate`
- `PromptVariables`
- `PromptManager`
- `PromptVersion`

The module loads markdown prompt files, registers legacy key-based prompts, registers versioned prompt assets, resolves explicit or latest prompt versions, validates required template variables, renders final prompt text, and exposes prompt metadata. It does not know about concrete AI providers.

Current content prompt assets:

- `content.article`
- `content.summary`
- `content.seo`
- `content.faq`
- `content.imagePrompt`
- `content.productPrompt`
- `content.system`
- `content.persona`
- `content.style.default`
- `content.style.blog`
- `content.style.magazine`
- `content.task`
- `content.outputSchema`

Prompt asset files live under `prompts/assets/content` and can evolve by adding new versions without changing workflow code.

Prompt profiles compose multiple prompt assets before provider generation. The current profiles are `default`, `blog`, and `magazine`; each profile resolves a system, persona, style, task, and output schema stack.

## `src/workflows`

Contains workflow orchestration. Workflows should be assembled from `WorkflowStep` instances and executed by a `WorkflowEngine`.

Current workflow core:

- `WorkflowContext`
- `WorkflowStep`
- `WorkflowResult`
- `WorkflowStatus`
- `WorkflowEngine`
- `SequentialWorkflowEngine`
- `WorkflowLogger`
- `contentGeneration/ContentGenerationWorkflow`

`SequentialWorkflowEngine` is intentionally minimal. It registers steps, executes them in order, supports cancellation between steps, stops on failure, and returns structured results.

`ContentGenerationWorkflow` is an application workflow for building a validated publishing package from one topic through an `AIProvider`. It is intentionally separate from publishing workflows and does not know about WordPress. It uses the Prompt Asset System for profile-based composed prompt input, the structured output layer for validation and normalization, the content quality service for structural quality metadata, the editorial review service for publication-readiness metadata, the real generation review service for review-only threshold calibration, and the editorial approval service for readiness decision metadata.

ContentGenerationWorkflow uses the shared `RetryService` for recoverable structured output failures. It preserves the existing `maxRetries` option, retry count metadata, and structured output recovery behavior while avoiding local retry-loop duplication.

CLI language options are passed into `ContentGenerationWorkflow` as Content Request language. The value is rendered into prompt variables, carried through composed prompt metadata, and attached to PublishingPackage metadata for dry-run inspection.

Magazine profile values are passed into `ContentGenerationWorkflow` by the composition boundary. The workflow receives provider-neutral content request values such as magazine name, language, audience, tone, and prompt profile style; it does not load magazine profile or template files itself.

Future workflows:

- Daily article publishing
- Weekly editorial planning
- Social post generation
- Podcast episode generation
- Analytics reporting

Future provider-backed steps should live near the workflow or service that composes them. For example, a daily publishing workflow can compose a research step using `ResearchProvider`, a content step using `ContentGenerator`, and a publishing step using `Publisher`.

Workflow composition should resolve providers through `ProviderRegistry` before constructing provider-backed steps. The engine itself should receive steps only.

## `src/magazines`

Contains optional magazine-specific behavior. Most magazines should start as configuration only. Add code here only when a magazine has unique rules that cannot be represented cleanly in config or prompts.

Current shared magazine dry-run runtime:

- `runtime/providerTokens`
- `runtime/mockProviders`
- `runtime/dryRunSteps`
- `runtime/runMagazineDryRun`

The runtime module is the shared composition root for magazine dry runs. It uses mock research, resolves the provider-agnostic Mock AI provider, resolves the WordPress publisher adapter in dry-run mode, resolves mock image libraries for image selection, resolves mock affiliate adapters for monetization preview, creates a dry-run Publishing Queue, creates a dry-run Scheduler preview, and creates a dry-run execution preview. It does not publish files, access real image storage, generate production affiliate links, execute real scheduled jobs, or call external APIs. Generic dry-run workflow execution and result shaping are delegated to `src/services/dryRun`.

Magazine dry-run supports explicit AI mode selection. Mock mode remains the default. OpenAI or Gemini mode can be selected for production AI generation only when environment safeguards are satisfied; publishing still remains disabled.

Dry-run supports explicit magazine profile selection through `--magazine cat` or `--magazine dog`. The composition loads `magazines/{slug}/profile.example.json`, resolves its template inheritance, and uses the merged profile for prompt composition values instead of assuming Cat Magazine literals.

Magazine-specific modules remain thin. `src/magazines/cat` keeps backward-compatible exports that delegate to the runtime, and `src/magazines/dog` delegates Dog dry runs to the same runtime.

## `magazines`

Contains runtime-facing magazine configuration examples and future real magazine configurations.

Magazine profiles live beside magazine configuration under `magazines/{slug}/profile.example.json`. Reusable templates live under `magazines/templates/{template}.example.json`. The current profiles are Cat and Dog, and the first template is `magazines/templates/blog.example.json`.

## `prompts`

Contains prompt assets:

- `prompts/shared`
- `prompts/magazines/{slug}`

Shared prompts define defaults. Magazine prompts may override shared prompts with the same key.
