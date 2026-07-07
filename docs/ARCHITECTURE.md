# Architecture

AI Publishing OS follows clean architecture principles. Domain concepts and application workflows should not depend on concrete providers such as OpenAI, Google Drive, WordPress, Coupang, Instagram, or podcast platforms.

## Layers

### Core

`src/core` contains the primary contracts used across the system. These interfaces define what the system needs, not how a vendor provides it.

### Domain

`src/domain` contains magazine, article, media, campaign, and publishing concepts. Domain objects should stay independent from API clients and external SDKs.

`src/domain/image` contains the storage-agnostic Image Asset Domain. It defines image assets, metadata, tags, categories, search queries, selection criteria, and scoring helpers that future image storage providers must support.

### Providers

`src/providers` is reserved for replaceable infrastructure adapters. Future examples include WordPress publishers, Google Drive image libraries, Coupang affiliate providers, and AI model providers.

The Provider Registry lives in `src/providers` and owns provider registration, lookup, removal, and lifecycle factory boundaries. Workflows and the Workflow Engine must not instantiate concrete providers directly.

`src/providers/publisher/wordpress` contains the WordPress publisher adapter draft. It implements the shared `Publisher` interface with mock-first dry-run behavior only. It validates payloads and returns structured preview results without calling WordPress APIs.

### Services

`src/services` is reserved for application services that combine core interfaces into useful operations, such as content planning, editorial validation, prompt rendering, and asset preparation.

`src/services/dryRun` contains the shared dry-run workflow foundation. It owns reusable dry-run result shaping, workflow construction, workflow execution helpers, and dry-run step helpers that are proven by the Cat Magazine dry run.

### Workflows

`src/workflows` is reserved for workflow definitions and orchestration code. Workflows should coordinate steps and persist state, but not embed provider-specific details.

The Workflow Engine is the central orchestration layer for Asteria. It executes small `WorkflowStep` units sequentially, passes a shared `WorkflowContext`, stops on failure, and returns a structured `WorkflowResult`.

Future provider-backed features such as AI generation, research, WordPress publishing, Instagram generation, TTS, podcast publishing, and analytics should plug into workflows through steps that depend on provider interfaces. The engine should never know which concrete provider is being used.

### Magazines

`src/magazines` is reserved for magazine-specific modules when configuration alone is not enough.

The first magazine-specific module is `src/magazines/cat`, which contains Cat-specific dry-run composition. It wires together Cat config loading, Cat prompt choices, Cat mock provider tokens, and Cat mock providers while using the shared dry-run workflow foundation for generic workflow execution and result shaping.

### Prompts

`src/prompts` is reserved for reusable prompt sets, templates, and prompt metadata.

Prompts are first-class assets. Prompt text should live under the root-level `prompts` directory, while prompt loading, registration, lookup, validation, and rendering logic should live under `src/prompts`.

Prompt inheritance is supported through registration order. Shared prompts load first from `prompts/shared`, then magazine-specific prompts load from `prompts/magazines/{slug}` and override matching prompt keys.

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

## Image Domain Boundary

The Image Asset Domain does not know about Google Drive, S3, local files, Cloudinary, or any other storage provider. Storage providers must adapt their own metadata into the domain image model before workflows or services search, score, or select images.

Image selection should be based on domain-level metadata such as topic, mood, tags, category, orientation, aspect ratio, rating, favorite status, source reference, and checksum. Provider-specific IDs may be stored only as source metadata, not as workflow assumptions.

## Workflow Failure Boundary

Workflow steps are the failure boundary. A step may fail without crashing the process. The engine records the failed step, returns a failed result, and leaves rollback or recovery policy to future workflow-specific layers.

## Prompt Boundary

AI providers should receive rendered prompt text from the Prompt Management System. Providers should not embed magazine-specific prompt strings, prompt inheritance rules, or template variable replacement logic.

## Dry-Run Composition Boundary

Dry-run workflows should be composed at the application or magazine boundary. Composition code may load config, load prompts, register mock providers, resolve provider interfaces, construct workflow steps, and execute the Workflow Engine through shared dry-run workflow services.

This keeps the Workflow Engine provider-agnostic while still allowing end-to-end architecture verification.

Shared dry-run code should only contain concepts already proven by a magazine dry run. Magazine-specific provider tokens, mock provider behavior, config choices, prompt keys, and content assumptions should remain in the magazine module.
