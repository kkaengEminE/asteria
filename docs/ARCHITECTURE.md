# Architecture

AI Publishing OS follows clean architecture principles. Domain concepts and application workflows should not depend on concrete providers such as OpenAI, Google Drive, WordPress, Coupang, Instagram, or podcast platforms.

## Layers

### Core

`src/core` contains the primary contracts used across the system. These interfaces define what the system needs, not how a vendor provides it.

### Domain

`src/domain` contains magazine, article, media, campaign, and publishing concepts. Domain objects should stay independent from API clients and external SDKs.

`src/domain/content` contains the provider-agnostic Content Domain. It defines canonical article, SEO, FAQ, category, tag, status, metadata, and content generation result models that future AI providers should produce.

The Content Domain now also defines the dry-run publishing package boundary: content request, publishing package, summary, SEO metadata alias, FAQ item alias, image prompt, and product prompt. This package is the provider-neutral output of the content generation pipeline and is not a publishing action.

`src/domain/image` contains the storage-agnostic Image Asset Domain. It defines image assets, metadata, tags, categories, search queries, selection criteria, and scoring helpers that future image storage providers must support.

`src/domain/monetization` contains the provider-agnostic Monetization Domain. It defines products, affiliate links, recommendations, recommendation reasons, product search queries, monetization results, and a mock monetization provider contract for future affiliate adapters.

`src/domain/editorialReview` contains the provider-agnostic Editorial Review Domain. It defines review results, issues, severity, categories, summaries, and review scores used to evaluate publishing readiness without making publishing decisions.

`src/domain/approval` contains the provider-neutral Approval Domain. It defines approval decisions, status, reasons, and structured approval results used to determine readiness without publishing.

### Providers

`src/providers` is reserved for replaceable infrastructure adapters. Future examples include WordPress publishers, Google Drive image libraries, Coupang affiliate providers, and AI model providers.

The Provider Registry lives in `src/providers` and owns provider registration, lookup, removal, and lifecycle factory boundaries. Workflows and the Workflow Engine must not instantiate concrete providers directly.

`src/providers/ai` contains the provider-agnostic AI Provider Foundation. It defines AI request, response, message, model, usage, and error contracts, plus a deterministic mock provider for dry runs and tests. It does not call real AI APIs.

`src/providers/ai/openai` contains the optional OpenAI adapter. It implements the shared AI provider contract, reads configuration only from environment variables or explicit constructor inputs, and uses a transport abstraction so tests can mock all API behavior. It is not the default dry-run provider.

In explicit OpenAI mode, the adapter consumes rendered Prompt Asset System output and requests a complete publishing package. It maps OpenAI-shaped responses, fenced JSON, surrounding text, and common field aliases into provider-neutral Content Domain models before workflow quality and editorial review metadata are attached.

`src/providers/publisher/wordpress` contains the WordPress publisher adapter draft. It implements the shared `Publisher` interface with mock-first dry-run behavior only. It validates payloads and returns structured preview results without calling WordPress APIs.

`src/providers/image/googleDrive` contains the Google Drive image library adapter draft. It uses local mock metadata only, maps Google Drive-shaped records into the storage-agnostic Image Asset Domain, and does not call Google APIs.

`src/providers/monetization/coupang` contains the Coupang affiliate adapter draft. It uses local mock Coupang-style product records only, maps them into the provider-agnostic Monetization Domain, and generates mock affiliate links without calling Coupang APIs.

### Services

`src/services` is reserved for application services that combine core interfaces into useful operations, such as content planning, editorial validation, prompt rendering, and asset preparation.

`src/services/dryRun` contains the shared dry-run workflow foundation. It owns reusable dry-run result shaping, workflow construction, workflow execution helpers, and dry-run step helpers that are proven by the Cat Magazine dry run.

`src/services/structuredOutput` contains the provider-neutral structured output layer. It validates, normalizes, and parses `PublishingPackage` output after provider generation and before workflow results are exposed.

`src/services/contentQuality` contains provider-neutral content quality validation. It checks generated publishing packages for completeness, empty sections, duplicate FAQ entries, summary length, article length, and SEO readiness, then records a simple 0-100 quality score for review.

`src/services/editorialReview` contains provider-neutral editorial readiness review. It evaluates generated publishing packages for completeness, readability, SEO coverage, duplicate FAQ entries, metadata, title quality, and summary quality, then records a separate 0-100 review score with structured issues.

`src/services/realGenerationReview` contains review-only calibration for real AI-generated publishing packages. It compares quality score, editorial review score, article length, SEO completeness, article structure, FAQ usefulness, and summary usefulness against configurable thresholds. It records threshold results for review, but it does not block or trigger publishing.

`src/services/editorialApproval` contains the Editorial Approval Gate. It evaluates validation, quality, editorial review, and threshold metadata to return `APPROVED`, `NEEDS_REVIEW`, or `REJECTED`. It records decisions and reasons only; it does not publish or call publishers.

### Workflows

`src/workflows` is reserved for workflow definitions and orchestration code. Workflows should coordinate steps and persist state, but not embed provider-specific details.

The Workflow Engine is the central orchestration layer for Asteria. It executes small `WorkflowStep` units sequentially, passes a shared `WorkflowContext`, stops on failure, and returns a structured `WorkflowResult`.

`ContentGenerationWorkflow` is an application workflow that receives a topic-level content request, calls an `AIProvider`, validates the returned publishing package, and returns a provider-neutral Content Domain model. It does not publish, select destinations, or call WordPress.

The workflow applies configurable retry policy for recoverable AI output failures such as empty responses, malformed JSON, and missing required sections. Retry and validation metadata are attached to the returned package for dry-run inspection.

The workflow resolves generation prompts through `PromptAssetRegistry`, composes profile-based prompt stacks, renders variables such as topic, language, audience, tone, and magazine name, and passes rendered prompt metadata through the provider-neutral request.

The workflow applies content quality validation after structured output parsing. Quality rules remain provider-neutral and attach review metadata to the returned publishing package; they do not publish content or alter provider boundaries.

The workflow applies editorial review after quality validation. Review metadata is attached to the returned publishing package for dry-run inspection only; the workflow does not approve, reject, or publish content.

The workflow also attaches real generation review metadata. This is a calibration layer for OpenAI-generated content and mock dry runs alike; it describes threshold readiness without becoming a publication gate.

The workflow attaches editorial approval metadata after review metadata is available. Approval decisions describe readiness for future publishing but do not trigger any publishing action.

Future provider-backed features such as AI generation, research, WordPress publishing, Instagram generation, TTS, podcast publishing, and analytics should plug into workflows through steps that depend on provider interfaces. The engine should never know which concrete provider is being used.

### Magazines

`src/magazines` is reserved for magazine-specific modules when configuration alone is not enough.

The first magazine-specific module is `src/magazines/cat`, which contains Cat-specific dry-run composition. It wires together Cat config loading, Cat prompt choices, Cat mock provider tokens, and Cat mock providers while using the shared dry-run workflow foundation for generic workflow execution and result shaping.

Cat Magazine dry run now includes image selection and monetization preview. The magazine composition registers mock Google Drive and Coupang providers, resolves them through Provider Registry, and passes storage-agnostic image and monetization interfaces into workflow steps.

### Prompts

`src/prompts` is reserved for reusable prompt sets, templates, and prompt metadata.

Prompts are first-class assets. Prompt text should live under the root-level `prompts` directory, while prompt loading, registration, lookup, validation, and rendering logic should live under `src/prompts`.

Prompt inheritance is supported through registration order. Shared prompts load first from `prompts/shared`, then magazine-specific prompts load from `prompts/magazines/{slug}` and override matching prompt keys.

Versioned prompt assets live under `prompts/assets`. The `PromptAssetRegistry` registers prompt assets, resolves explicit versions, resolves the latest version, renders template variables, and exposes prompt metadata. Workflows request prompt assets by id and version instead of embedding prompt text.

Prompt composition is profile-based. A profile such as `default`, `blog`, or `magazine` resolves a stack of prompt assets including system, persona, style, task, and output schema prompts. The composed prompt is sent to AI providers as rendered text, while prompt ids, versions, variables, and previews remain visible in dry-run metadata.

### Config

`src/config` is reserved for configuration loading, validation, and environment-safe defaults.

### Utils

`src/utils` is reserved for small shared utilities that are not domain-specific.

## Dependency Rule

Outer layers may depend on inner layers. Inner layers should not depend on outer layers.

Recommended direction:

`providers -> services -> workflows -> core/domain`

Concrete providers should implement core interfaces. Workflows should depend on interfaces, not concrete classes.

## Provider Replacement

Every external integration should be hidden behind an interface. This allows:

- Local test doubles.
- Vendor replacement.
- Magazine-specific provider choices.
- Safe dry-run workflows.
- Human review before publication.

Provider adapters should be composed into workflow steps by services or workflow factories. This keeps provider setup outside the engine and lets tests use mock steps or in-memory providers.

Provider resolution should happen through the Provider Registry. Application composition code may resolve provider interfaces and pass them into workflow steps. The registry should not be used as a hidden global dependency inside domain objects or low-level utilities.

Provider categories include:

- AI
- Research
- Publisher
- Image
- Affiliate
- TTS
- Podcast
- Analytics

## Publisher Boundary

Publishers implement the `Publisher` interface and receive `PublishingPayload` values. Provider-specific payload mapping and validation belong inside the provider adapter. Workflow steps should depend on `Publisher`, not WordPress-specific classes.

The current WordPress adapter is a dry-run draft. It does not use a WordPress SDK, credentials, network calls, or production publishing behavior.

## AI Provider Boundary

AI providers receive rendered prompts or provider-neutral content requests only. They must not know about workflow orchestration, prompt files, publishers, image libraries, monetization providers, magazine config loading, or publishing destinations.

The AI Provider Foundation defines shared request and response models for future OpenAI, Claude, Gemini, OpenRouter, and local LLM adapters. Provider adapters should report usage and structured errors through the shared AI contracts before workflow steps consume generation results.

The current Mock AI provider is deterministic and dry-run only. It returns predictable content, usage metadata, token counts, stream-compatible output, and health check results without network calls.

The OpenAI adapter is the first real AI provider boundary. OpenAI-specific request mapping, response mapping, error mapping, transport behavior, environment configuration, production enablement checks, and response normalization stay inside the adapter. Production calls are disabled unless the adapter is explicitly configured with an API key and `OPENAI_PRODUCTION_ENABLED=true`. Dry-run composition continues to resolve the deterministic Mock AI provider by default.

For the content generation pipeline, AI providers may also receive a provider-neutral `ContentRequest` and return a provider-neutral `PublishingPackage`. Provider-specific serialization, JSON prompting, parsing, response cleanup, alias mapping, and error mapping remain inside the provider adapter.

Production AI mode is opt-in at the composition boundary. Cat dry-run defaults to `MockAIProvider`; OpenAI is used only when dry-run composition is explicitly configured with `aiMode: openai` or the CLI receives `--ai openai`. OpenAI still requires `OPENAI_PRODUCTION_ENABLED=true` and `OPENAI_API_KEY` before transport calls are allowed.

## Content Domain Boundary

The Content Domain does not know about OpenAI, Claude, Gemini, WordPress, workflows, prompt files, or provider adapters. It defines the canonical shape of generated content after provider output is parsed or normalized.

Future AI-backed generation should produce or be transformed into `ContentGenerationResult`, which can include an article, SEO metadata, FAQ entries, and provider-agnostic metadata. Publishing adapters should receive content after it has passed domain validation rather than relying on provider-specific output strings.

The current pipeline validates `PublishingPackage` before exposing it to dry-run output. Required sections are article, summary, SEO metadata, at least one FAQ item, image prompt, and product prompt.

Structured output validation returns descriptive errors for missing or empty required fields. Normalization trims whitespace, collapses repeated whitespace, removes duplicate FAQ items, extracts fenced JSON when possible, and fills safe optional defaults through existing Content Domain creation helpers.

## Image Domain Boundary

The Image Asset Domain does not know about Google Drive, S3, local files, Cloudinary, or any other storage provider. Storage providers must adapt their own metadata into the domain image model before workflows or services search, score, or select images.

Image selection should be based on domain-level metadata such as topic, mood, tags, category, orientation, aspect ratio, rating, favorite status, source reference, and checksum. Provider-specific IDs may be stored only as source metadata, not as workflow assumptions.

The current Google Drive image library adapter is a mock-first draft. Drive file IDs and mock URIs stay inside adapter records or domain source metadata. OAuth, Google SDK usage, real Drive access, and network calls are deferred.

## Monetization Domain Boundary

The Monetization Domain does not know about Coupang, Amazon, Temu, or any affiliate implementation. Affiliate providers must adapt their own product catalogs and link generation into the domain product, recommendation, affiliate link, and monetization result models.

Monetization workflows should operate on provider-agnostic product metadata such as name, category, tags, brand, price, currency, rating, thumbnail, URL, and provider name. Provider-specific APIs, credentials, tracking parameters, and commission rules belong in future adapters.

The current Coupang affiliate adapter is a mock-first draft. Coupang-shaped product IDs and records stay inside the adapter or product metadata. SDK usage, API credentials, real Coupang Partners links, network calls, and production monetized publishing are deferred.

## Workflow Failure Boundary

Workflow steps are the failure boundary. A step may fail without crashing the process. The engine records the failed step, returns a failed result, and leaves rollback or recovery policy to future workflow-specific layers.

## Prompt Boundary

AI providers should receive rendered prompt text from the Prompt Management System. Providers should not embed magazine-specific prompt strings, prompt inheritance rules, or template variable replacement logic.

Prompt version metadata starts at `v1` and is passed through content generation metadata. Future prompt revisions should change prompt assets or composition metadata without forcing workflow rewrites.

Prompt asset metadata includes prompt id, version, source, description, and required variables. Dry-run output displays prompt id, version, rendered variables, and a truncated rendered prompt preview for review.

When OpenAI is used, rendered prompt asset text is passed through provider-neutral request metadata into the OpenAI adapter. The adapter uses that rendered prompt text while keeping OpenAI-specific JSON shape instructions inside the adapter.

Prompt profiles let future magazines choose a composition style without changing workflow logic. The current profiles are `default`, `blog`, and `magazine`.

## Content Quality Boundary

Content quality validation runs after structured output parsing and before dry-run reporting. It is intentionally separate from AI providers, prompt assets, publishers, image providers, and monetization providers.

Quality scoring is simple and review-oriented. The score starts at 100 and is reduced by provider-neutral validation errors and warnings. It should guide editorial review, not act as an automatic publishing gate.

## Editorial Review Boundary

Editorial review runs after content quality validation and before dry-run reporting. It is provider-neutral and evaluates whether a generated `PublishingPackage` looks ready for human editorial review.

Review score is separate from quality score. Quality score describes structural completeness; review score describes editorial readiness. The current review result can be `PASS`, `WARNING`, or `FAIL`, and each issue includes category, severity, message, and recommendation.

Editorial review metadata must not trigger publishing decisions yet. Future approval gates can consume the review output, but this sprint only records and displays it.

## Real Generation Review Boundary

Real generation review runs after quality and editorial review metadata exist. It compares generated content against configurable review thresholds such as minimum quality score, minimum review score, minimum article length, and required SEO fields.

The threshold result can be `PASS`, `WARNING`, or `FAIL`, but it is informational only. Since publishing does not exist yet, this layer must not block, approve, publish, or mutate provider behavior.

## Editorial Approval Boundary

Editorial approval runs after validation, quality scoring, editorial review, and real generation review. It returns one of `APPROVED`, `NEEDS_REVIEW`, or `REJECTED`.

Approval results include reasons, recommendations, blocking issues, and non-blocking issues. They are metadata only. The approval gate must not instantiate publishers, call WordPress, or publish content.

## Dry-Run Composition Boundary

Dry-run workflows should be composed at the application or magazine boundary. Composition code may load config, load prompts, register mock providers, resolve provider interfaces, construct workflow steps, and execute the Workflow Engine through shared dry-run workflow services.

This keeps the Workflow Engine provider-agnostic while still allowing end-to-end architecture verification.

Shared dry-run code should only contain concepts already proven by a magazine dry run. Magazine-specific provider tokens, mock provider behavior, config choices, prompt keys, and content assumptions should remain in the magazine module.

Image preview fields in dry-run results should expose domain-level image information such as filename, tags, category, score, and preview URI. Provider-specific identifiers such as Google Drive file IDs must remain inside adapter records or source metadata.

Monetization preview fields in dry-run results should expose domain-level product recommendations, generic affiliate links, preview text, and disclosure text. Provider-specific identifiers such as Coupang product IDs must remain inside adapter records or product metadata.
