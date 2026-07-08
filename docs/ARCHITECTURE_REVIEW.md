# Architecture Review

## Strengths

- Clean architecture direction is consistent across domains, providers, services, workflows, and magazine composition.
- Provider Registry keeps concrete provider construction out of the Workflow Engine.
- Domains are provider-agnostic:
  - Content does not know AI providers, WordPress, workflows, or prompt files.
  - Image does not know Google Drive or storage APIs.
  - Monetization does not know Coupang or affiliate APIs.
- The Cat Magazine dry run proves config, prompts, providers, workflow execution, image selection, monetization preview, AI generation, and publisher preview together.
- ADR coverage is strong and explains the major architectural boundaries.
- Tests cover current provider drafts, domain validation, failure cases, and dry-run behavior.
- The disabled GitHub Actions workflow documents the future scheduler entry point without operational risk.

## Weaknesses

- There are duplicated or overlapping interface layers:
  - `src/core/AIProvider.ts` overlaps with `src/providers/ai/AIProvider.ts`.
  - `src/core/types.ts` includes `ImageAsset` and `AffiliateLink`, while provider-agnostic domain versions exist under `src/domain/image` and `src/domain/monetization`.
  - `src/core/WorkflowStep.ts` and `src/workflows/WorkflowStep.ts` both define workflow step concepts.
- `tests/providerRegistry.test.ts` still uses the older `src/core/AIProvider` contract instead of the newer AI Provider Foundation.
- Some `src/core` interfaces are architectural placeholders and are not yet actively used by workflows.
- The Cat Magazine dry run remains the only end-to-end magazine, so shared abstractions have not yet been tested against a second magazine.
- AI generation currently returns deterministic strings, not `ContentGenerationResult`.

## Technical Debt

- Migrate or alias old `src/core/AIProvider` to the provider AI foundation after the OpenAI adapter shape is proven.
- Decide whether `src/core/types.ts` should keep early generic media and affiliate shapes or defer to domain models.
- Align workflow contracts by either retiring early `src/core/WorkflowStep` / `src/core/WorkflowEngine` placeholders or documenting them as legacy foundation interfaces.
- Consider exporting concrete provider submodules from higher-level provider barrels only when a stable public import strategy is chosen.
- Introduce a parser or mapper layer from raw AI responses into `ContentGenerationResult`.

## Refactoring Suggestions

- Short term:
  - Leave duplicated interfaces in place for v0.1.0 to avoid destabilizing the release.
  - Document duplicates as known cleanup targets.
  - Keep Cat dry-run behavior unchanged.

- Near term:
  - Update provider registry tests to use `src/providers/ai` instead of `src/core/AIProvider`.
  - Add a content mapping service that turns AI responses into `ContentGenerationResult`.
  - Add compatibility exports or deprecation notes for superseded core interfaces.

- Later:
  - Introduce a second magazine dry run to validate shared workflow abstractions.
  - Add persistence boundaries only after real provider integrations require them.
  - Add policy layers for editorial review, affiliate disclosure, and production publishing gates.

## Risk Analysis

- Real API integrations will introduce secrets, network failures, rate limits, cost control, retries, and observability requirements.
- Real publishing creates irreversible side effects and must require explicit production gates.
- Real affiliate integrations require disclosure, compliance, product freshness, and tracking controls.
- Real image storage access requires OAuth, permission management, pagination, and caching decisions.
- Real AI generation may return malformed content, making Content Domain validation and parsing essential.
- Scheduling should remain disabled until production safeguards are proven.

## Future Scalability

- The current provider registry and domain separation should scale to multiple magazines and multiple provider implementations.
- Magazine-specific code should stay in `src/magazines/{slug}` only when config and prompts are insufficient.
- Content, Image, and Monetization domains provide reusable foundations for future social, podcast, analytics, and publishing workflows.
- The dry-run-first pattern should remain the default for every new production-facing capability.
- A second magazine dry run is the best next architectural pressure test after real AI generation begins.

## Review Findings

- Duplicated interfaces found:
  - `src/core/AIProvider.ts` and `src/providers/ai/AIProvider.ts`.
  - `src/core/types.ts` `ImageAsset` and `src/domain/image/ImageAsset.ts`.
  - `src/core/types.ts` `AffiliateLink` and `src/domain/monetization/AffiliateLink.ts`.
  - `src/core/WorkflowStep.ts` and `src/workflows/WorkflowStep.ts`.

- Obsolete-file candidates:
  - No files should be deleted for v0.1.0.
  - Early `src/core` interfaces are candidates for future consolidation, not immediate removal.

- Dead-code candidates:
  - No confirmed dead code was removed.
  - Some early `src/core` interfaces are unused or lightly used, but they still document intended contracts and should remain until the real adapter sprints clarify final ownership.

- Architecture inconsistencies:
  - The roadmap has shifted from OpenAI Adapter as Sprint 16 to Content Domain Foundation as Sprint 16. This is intentional and should be treated as the release baseline.
  - AI provider output is still string-based in the dry run, while the new Content Domain defines the future canonical model. This is an expected transition state for v0.1.0.
