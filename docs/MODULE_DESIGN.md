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

The content domain defines canonical generated content models and validation helpers. It does not know about AI providers, prompt files, workflows, WordPress, or publishing adapters.

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

Current OpenAI adapter:

- `providers/ai/openai/OpenAIProvider`
- `providers/ai/openai/OpenAIConfig`
- `providers/ai/openai/OpenAITransport`
- `providers/ai/openai/OpenAIMapper`

The OpenAI adapter implements `AIProvider` without becoming the default provider. It reads environment-based configuration, requires explicit production enablement before transport calls, maps OpenAI-shaped responses into provider-neutral `AIResponse` values, and supports mocked transports for tests.

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

## `src/prompts`

Contains prompt management logic:

- `PromptLoader`
- `PromptRegistry`
- `PromptTemplate`
- `PromptVariables`
- `PromptManager`

The module loads markdown prompt files, registers them by key, validates required template variables, and renders final prompt text. It does not know about concrete AI providers.

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

`SequentialWorkflowEngine` is intentionally minimal. It registers steps, executes them in order, supports cancellation between steps, stops on failure, and returns structured results.

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

## `magazines`

Contains runtime-facing magazine configuration examples and future real magazine configurations.

## `prompts`

Contains prompt assets:

- `prompts/shared`
- `prompts/magazines/{slug}`

Shared prompts define defaults. Magazine prompts may override shared prompts with the same key.
