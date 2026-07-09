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

## `src/providers`

Contains adapters for external systems. Future providers should be added behind interfaces, for example:

- `providers/ai/openai`
- `providers/images/google-drive`
- `providers/publishing/wordpress`
- `providers/affiliate/coupang`
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

Current editorial approval service foundation:

- `EditorialApprovalService`

The editorial approval service evaluates validation result, content quality report, editorial review, and real generation review. It returns `APPROVED`, `NEEDS_REVIEW`, or `REJECTED` with structured reasons, recommendations, blocking issues, and non-blocking issues. It is an approval metadata layer only and does not publish.

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

Current Cat Magazine dry-run module:

- `providerTokens`
- `mockProviders`
- `dryRunSteps`
- `runCatMagazineDryRun`

The dry-run module is a composition root for the first end-to-end architecture check. It uses mock research, resolves the provider-agnostic Mock AI provider, resolves the WordPress publisher adapter in dry-run mode, resolves the mock Google Drive image library for image selection, and resolves the mock Coupang affiliate adapter for monetization preview. It does not publish files, access real image storage, generate production affiliate links, or call external APIs. Generic dry-run workflow execution and result shaping are delegated to `src/services/dryRun`.

Cat dry-run now supports explicit AI mode selection. Mock mode remains the default. OpenAI mode can be selected for production AI generation only when environment safeguards are satisfied; publishing still remains disabled.

## `magazines`

Contains runtime-facing magazine configuration examples and future real magazine configurations.

## `prompts`

Contains prompt assets:

- `prompts/shared`
- `prompts/magazines/{slug}`

Shared prompts define defaults. Magazine prompts may override shared prompts with the same key.
