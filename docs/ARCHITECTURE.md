# Architecture

AI Publishing OS follows clean architecture principles. Domain concepts and application workflows should not depend on concrete providers such as OpenAI, Google Drive, WordPress, Coupang, Instagram, or podcast platforms.

## Layers

### Core

`src/core` contains the primary contracts used across the system. These interfaces define what the system needs, not how a vendor provides it.

### Domain

`src/domain` contains magazine, article, media, campaign, and publishing concepts. Domain objects should stay independent from API clients and external SDKs.

### Providers

`src/providers` is reserved for replaceable infrastructure adapters. Future examples include WordPress publishers, Google Drive image libraries, Coupang affiliate providers, and AI model providers.

### Services

`src/services` is reserved for application services that combine core interfaces into useful operations, such as content planning, editorial validation, prompt rendering, and asset preparation.

### Workflows

`src/workflows` is reserved for workflow definitions and orchestration code. Workflows should coordinate steps and persist state, but not embed provider-specific details.

### Magazines

`src/magazines` is reserved for magazine-specific modules when configuration alone is not enough.

### Prompts

`src/prompts` is reserved for reusable prompt sets, templates, and prompt metadata.

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

