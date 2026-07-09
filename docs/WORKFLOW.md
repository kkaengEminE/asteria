# Workflow

The publishing flow should be built from small, replaceable workflow steps.

## Workflow Engine Foundation

The Workflow Engine executes registered `WorkflowStep` instances in sequence. Each step receives a `WorkflowContext` and returns a `WorkflowStepResult`.

The engine is responsible for:

- Preserving execution order.
- Passing context from one step to the next.
- Stopping on failure.
- Returning a structured `WorkflowResult`.
- Supporting cancellation between steps.
- Accepting a simple logger interface.

The engine is not responsible for:

- Calling provider APIs directly.
- Choosing AI models.
- Loading or rendering prompt files directly.
- Resolving or instantiating providers.
- Publishing content itself.
- Retrying provider operations.
- Storing workflow state permanently.

## Target Daily Publishing Flow

1. Load magazine configuration.
2. Select topic or editorial plan item.
3. Load and render the relevant prompt.
4. Research the topic.
5. Generate or normalize content into the Content Domain.
6. Run content quality validation.
7. Run editorial review.
8. Select image candidates.
9. Choose the best image.
10. Add affiliate recommendations when configured.
11. Prepare publishing payload.
12. Publish or create a dry-run preview.
13. Generate social derivatives when enabled.
14. Generate TTS and podcast output when enabled.
15. Record analytics metadata.

## Cat Magazine Dry Run

The Cat Magazine dry run verifies the current foundation without external APIs.

Current dry-run flow:

1. Load Cat Magazine configuration.
2. Load and render article and SEO prompts.
3. Resolve mock research, AI, image, monetization, and publisher providers through `ProviderRegistry`.
4. Select an image with the mock Google Drive image library.
5. Generate monetization preview with the mock Coupang affiliate adapter.
6. Build workflow execution through `DryRunWorkflowFactory`.
7. Execute workflow steps through `SequentialWorkflowEngine`.
8. Return a shared `DryRunResult`.
9. Print a readable CLI report with `npm run dry-run`.

No real AI generation, research, publishing, secrets, or files are produced.

The AI provider in this flow is resolved through `ProviderRegistry` and currently uses the deterministic Mock AI provider from `src/providers/ai`. Workflow steps pass rendered prompt text to the provider and consume provider-agnostic AI responses.

The OpenAI adapter exists as an optional provider but is not used by the Cat dry run by default. This keeps the end-to-end architecture check deterministic and free of required credentials.

The publisher in this flow is resolved through `ProviderRegistry` and currently uses the WordPress publisher adapter in dry-run mode. The adapter returns a preview result only.

The image library in this flow is resolved through `ProviderRegistry` and currently uses the Google Drive image library adapter in dry-run mode. The adapter uses mock records only and returns storage-agnostic image assets.

The monetization provider in this flow is resolved through `ProviderRegistry` and currently uses the Coupang affiliate adapter in dry-run mode. The adapter uses mock product records only and returns provider-agnostic recommendations with `mock://` affiliate links.

## Shared Dry-Run Workflow Foundation

Shared dry-run services extract only the generic pieces proven by Cat Magazine:

- Workflow step helper creation.
- Required workflow data lookup.
- Workflow engine construction.
- Dry-run workflow execution.
- Dry-run result shaping for status, executed steps, rendered prompt preview, article preview, SEO preview, image preview, monetization preview, and publish preview.

Magazine modules remain responsible for config selection, prompt choices, provider tokens, mock providers, and magazine-specific step composition.

## Dry-Run First

All workflows should support dry-run mode before any production publishing exists. Dry-run output should make it clear what would be generated, what provider would be used, and which destination would receive content.

## Human Review

The architecture should allow human approval gates before:

- Publishing articles.
- Posting to social platforms.
- Generating affiliate links at scale.
- Publishing podcast episodes.

## Error Handling Direction

Workflow steps should report structured results. A failed step should identify:

- Step name.
- Failure reason.
- Whether retry is safe.
- Partial output, if any.
- Suggested recovery action.

The current engine stops at the first failed step and returns the accumulated step results. Future workflow-specific policies may add retries, rollback, or human review gates without changing provider interfaces.

## Provider Integration Direction

Future providers plug into workflows through composed steps:

1. Application composition registers provider factories in `ProviderRegistry`.
2. A workflow factory resolves needed provider interfaces from the registry.
3. The factory builds provider-backed `WorkflowStep` instances.
4. The engine executes those steps without knowing provider details.
5. Tests can replace providers or steps with mock implementations.

The registry should stay at the composition boundary. Workflow steps may receive provider interfaces as constructor inputs, but the Workflow Engine should never instantiate or resolve providers directly.

Publisher provider steps should receive the shared `Publisher` interface. WordPress-specific validation and preview mapping happen inside the WordPress adapter, not in the Workflow Engine.

AI provider steps should receive the shared AI provider interface from `src/providers/ai`. Prompt loading and rendering happen before provider calls, and providers receive only rendered prompt content.

OpenAI-backed steps should be introduced through composition only. The workflow factory may resolve an OpenAI-backed `AIProvider` when production mode is explicitly enabled, but the Workflow Engine and Content Domain should continue to see only provider-neutral request, response, usage, and error models.

Content generation steps should normalize provider output into the Content Domain before publishing. The canonical generation output is `ContentGenerationResult`, containing validated article, SEO, FAQ, and metadata fields.

Editorial review should run after structured output parsing and content quality validation. Review output is provider-neutral metadata only: result, score, summary, and issues with category, severity, message, and recommendation.

## Image Selection Direction

Future image workflows should use the Image Asset Domain before calling storage-specific adapters.

Expected image flow:

1. Build an `ImageSearchQuery` from the article topic, mood, tags, rating needs, and aspect ratio.
2. Ask an image library provider for candidates.
3. Normalize provider results into domain `ImageAsset` values.
4. Score candidates with domain `ImageSelectionCriteria`.
5. Select an image without exposing storage-specific details to the Workflow Engine.

Google Drive, S3, local storage, and Cloudinary remain provider adapter concerns.

The current Google Drive image library adapter uses mock records only. It can verify provider registration, metadata mapping, search, and selection behavior before real Google Drive access exists.

Cat Magazine currently selects images using topic-derived tags, category preference, minimum rating, favorite scoring, and domain image scoring. The CLI reports filename, tags, category, score, and mock preview URI.

## Monetization Direction

Future monetization workflows should use the Monetization Domain before calling affiliate-specific adapters.

Expected monetization flow:

1. Build a `ProductSearchQuery` from the article topic, category, tags, and rating requirements.
2. Ask a monetization provider for provider-agnostic products.
3. Generate recommendations with reason, confidence, priority, and score.
4. Generate affiliate links through the provider boundary.
5. Add monetization previews to publishing payloads only after disclosure and review rules are satisfied.

Coupang, Amazon, Temu, tracking parameters, API credentials, commission logic, and product feed details remain provider adapter concerns.

The current Coupang affiliate adapter is registered in the Cat Magazine dry run through `ProviderRegistry` and resolved as a `MonetizationProvider`. It uses mock product records, returns domain `Product` and `Recommendation` values, and generates `mock://` affiliate links only. The dry run prints recommended products, recommendation reasons, mock links, and plain disclosure preview text without publishing monetized content.

## Prompt Integration Direction

Prompt rendering should happen before AI provider calls. A content generation step can load the magazine config, ask `PromptManager` for the correct prompt, render it with typed variables, and pass only the final text to an `AIProvider`.

Prompt lookup order:

1. Load shared prompts.
2. Load magazine prompts.
3. Let magazine prompts override shared prompts with the same key.
4. Render the selected prompt with required variables.

## Content Generation Direction

Future real article and SEO generation should produce or be parsed into `ContentGenerationResult`.

Expected content flow:

1. Render prompts through `PromptManager`.
2. Send rendered prompt content to an AI provider.
3. Parse or map provider output into `Article`, `SEO`, and optional `FAQ` values.
4. Validate the result with the Content Domain.
5. Add structural quality metadata.
6. Add editorial review metadata.
7. Pass validated content into publishing, social, monetization, or review steps.

The Content Domain remains independent from OpenAI, Claude, Gemini, WordPress, workflows, and prompt files.

## Editorial Review Direction

Current editorial review output is informational. It does not publish, block publishing, or approve content automatically. Future human approval gates can consume this review metadata without changing AI providers, content models, or the Workflow Engine.
