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

The dry-run services provide shared workflow construction, workflow execution, step helper utilities, and dry-run result shaping. They do not know about Cat Magazine prompts or provider implementations.

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

The dry-run module is a composition root for the first end-to-end architecture check. It uses only mock providers and does not publish files or call external APIs. Generic dry-run workflow execution and result shaping are delegated to `src/services/dryRun`.

## `magazines`

Contains runtime-facing magazine configuration examples and future real magazine configurations.

## `prompts`

Contains prompt assets:

- `prompts/shared`
- `prompts/magazines/{slug}`

Shared prompts define defaults. Magazine prompts may override shared prompts with the same key.
