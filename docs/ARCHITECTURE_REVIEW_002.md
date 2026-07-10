# Architecture Review 002

Review date: 2026-07-10

Scope: Post-Sprint 39 review, covering Sprint 36 through Sprint 39 at the Sprint 40 planning checkpoint.

## Health Score

87 / 100

## Comparison With Architecture Review 001

Architecture Review 001 scored Asteria at 84 / 100. The current score improves to 87 / 100 because the last sprint group added queue, audit, and retry foundations without introducing provider-specific leakage, and Sprint 39 reduced duplicated retry logic inside `ContentGenerationWorkflow`.

The score does not rise further because the main accepted deferrals from Review 001 still remain:

- `ContentGenerationWorkflow` still imports the provider-neutral AI port from `src/providers/ai`.
- Early `src/core` contracts still overlap with newer domain and provider models.
- Compatibility wrappers remain in use.
- No broader dependency-cycle validation exists yet.

## Improvements

- Publishing Queue is provider-neutral and does not depend on WordPress, scheduler infrastructure, or publisher adapters.
- PublishingWorkflow can create queue results without invoking publisher adapters, preserving publishing-disabled behavior.
- Audit Log is observational and provider-neutral. It records workflow and queue activity without changing decisions or triggering side effects.
- RetryService is reusable across future AI, storage, publishing, and scheduler work.
- ContentGenerationWorkflow now uses RetryService for structured output recovery instead of a local retry loop.
- Dry-run output now exposes queue, audit, and retry metadata without enabling production behavior.
- Documentation for architecture, module design, roadmap, and README has stayed current with the new foundations.
- Tests expanded around queue approval guards, audit timeline behavior, retry policy behavior, and retry migration.

## Regressions

- ContentGenerationWorkflow now has more injected service collaborators: quality, review, approval, audit, retry, parser, and prompt registry. This is still manageable, but the constructor is becoming dense.
- AuditLog is injected directly into ContentGenerationWorkflow, EditorialApprovalService, and PublishingQueue. This is acceptable for the current in-memory foundation, but a smaller audit sink or event recorder port may be cleaner before persistence.
- DryRunResult continues to accumulate preview fields for many subsystems. It is useful for demos, but it is becoming a broad reporting DTO.
- Resolved by Architecture Cleanup Patch 002: PublishingQueue now enforces explicit provider-neutral status transition rules and returns invalid transition results for disallowed moves.

## Layer Boundaries

Domain boundaries remain mostly clean.

New domain modules are provider-neutral:

- `src/domain/publishingQueue`
- `src/domain/audit`
- `src/domain/retry`

The queue, audit, and retry domains do not know about WordPress, Coupang, OpenAI, Gemini, Google Drive, scheduler infrastructure, SDKs, or transport clients.

Service boundaries are mostly consistent:

- `src/services/publishingQueue` owns queue behavior and in-memory queue storage.
- `src/services/auditLog` owns audit event append/list/filter behavior.
- `src/services/retry` owns retry execution policy and attempt history.

The largest boundary concern remains the older `src/core` versus newer domain/provider split, not the Sprint 36-39 additions.

## Provider Neutrality

Provider neutrality remains strong.

- Queue destinations are generic and do not expose WordPress-specific models.
- Audit events use generic actor, context, event type, message, timestamp, and metadata fields.
- Retry reasons are generic and not tied to provider-specific error classes.
- Magazine runtime still imports concrete providers, but that runtime is the composition root. This remains acceptable.
- Workflow boundary guard still prevents workflows from importing concrete provider implementations.

## Retry Architecture

Retry architecture improved.

Strengths:

- Retry policy, attempt, result, and reason models are provider-neutral.
- RetryService supports max attempts, fixed delay metadata, retryable/non-retryable classification, and history.
- ContentGenerationWorkflow now delegates structured output retry to RetryService.
- Existing retry metadata remains stable.

Weaknesses:

- RetryService does not yet support backoff, jitter, real delay, cancellation, or integration with a scheduler.
- Provider adapters do not yet use RetryService directly.
- Retry history is visible in dry-run metadata only through the mock retry probe, while ContentGenerationWorkflow still exposes only retry count in package metadata.

## Queue Architecture

Queue architecture is sound for a foundation.

Strengths:

- Queue domain is independent from publisher adapters.
- Queue service has an in-memory storage boundary.
- Approval guard rejects non-approved packages before the ready-to-publish path.
- Dry-run queue preview does not invoke publishers.

Weaknesses:

- Queue IDs are deterministic in-memory IDs.
- Resolved by Architecture Cleanup Patch 002: status transitions are guarded.
- Resolved by Architecture Cleanup Patch 002: queue rejection emits a provider-neutral `QUEUE_REJECTED` audit event.
- Persistence, idempotency, locking, and scheduling semantics remain undefined.

## Audit Architecture

Audit architecture is simple and appropriately observational.

Strengths:

- Audit domain is provider-neutral.
- Audit service has an in-memory storage boundary.
- Events can be filtered by entity and event type.
- Audit logging does not affect workflow behavior.

Weaknesses:

- Audit context is flexible but not yet governed by a schema per entity type.
- No retention, privacy, redaction, or persistence policy exists yet.
- AuditLog is injected directly rather than through a minimal event recorder interface.
- Accepted direction: future audit persistence should be implemented behind an AuditStore-style storage port used by AuditLog. Workflows and queue services should continue depending on AuditLog or a smaller AuditRecorder facade, not on persistence adapters.

## Dependency Direction

Dependency direction is acceptable for the current foundation.

Known accepted issue from Review 001:

- `ContentGenerationWorkflow` imports `AIProvider` from `src/providers/ai`.

New Sprint 36-39 dependencies are mostly reasonable:

- Domain modules do not depend on services, providers, workflows, or runtime.
- Services depend on domain models.
- Workflow composes provider-neutral services and provider-neutral AI interface.
- Runtime composes concrete providers and passes provider-neutral interfaces into steps.

Potential future cleanup:

- Define a neutral application port location for AIProvider.
- Consider an `AuditRecorder` interface if external sinks or cross-service event fanout arrive.
- Resolved by Architecture Cleanup Patch 002: stronger transition policies for PublishingQueue are now implemented.

## Remaining Duplication

Remaining duplication from Review 001 still exists:

- `src/core/AIProvider.ts` overlaps with `src/providers/ai/AIProvider.ts`.
- `src/core/types.ts` overlaps with newer domain models such as image and monetization types.
- Cat compatibility wrappers remain.

Sprint 39 reduced one duplication point:

- ContentGenerationWorkflow no longer owns a local retry loop separate from RetryService.

## Technical Debt

- AIProvider boundary location is still not ideal.
- Early core contracts still need consolidation.
- DryRunResult is becoming a wide aggregation object.
- Resolved by Architecture Cleanup Patch 002: PublishingQueue transition validation now rejects invalid transitions.
- Audit event schema and redaction rules are not production-ready.
- RetryService needs production-grade backoff and cancellation policy before broad external-provider use.
- Dependency validation still focuses on workflows importing concrete providers; it does not yet cover all service/provider cycles.

## Testability

Testability improved.

- Queue behavior has unit tests for enqueue, rejection, lookup, transitions, cancellation, failure, and no publisher invocation.
- Audit behavior has tests for recording, filtering, ordering, workflow integration, queue integration, and dry-run output.
- Retry behavior has tests for success after retry, exhaustion, non-retryable failure, history, policy enforcement, workflow proof, and migration into ContentGenerationWorkflow.
- Architecture boundary guard remains in place.

Remaining gaps:

- Resolved by Architecture Cleanup Patch 002: the architecture boundary guard now includes relative import cycle detection.
- Resolved by Architecture Cleanup Patch 002: queue transition tests cover valid transitions, invalid transitions, terminal statuses, and explicit failed-item retry.
- No tests for audit redaction or persistence because those concerns are not implemented.

## Documentation Consistency

Documentation is consistent with implementation after Sprint 39.

Current docs reflect:

- Publishing Queue boundary and transition policy.
- Audit Log boundary.
- Retry boundary.
- ContentGenerationWorkflow retry migration.
- Roadmap shift from Real Coupang Integration to Retry Migration.

One older release document may still predate the latest queue/audit/retry work and should be refreshed before the next tagged release.

## Immediate Actions

Recommended before the next production integration:

- Resolved by Architecture Cleanup Patch 002: add a lightweight dependency-cycle or broader boundary check for services and providers.
- Resolved by Architecture Cleanup Patch 002: define queue transition rules before real publishing or scheduling.
- Resolved by Architecture Cleanup Patch 002: queue rejection results now record audit events.
- Keep Real Coupang Integration on HOLD until the Founder/GPT confirms whether reliability cleanup or monetization is the next priority.

## Deferred Actions

Still acceptable to defer:

- Move AIProvider to a neutral application port boundary.
- Retire duplicate early `src/core` contracts.
- Replace direct AuditLog injection with an `AuditRecorder` port.
- Add retry backoff, jitter, cancellation, and real delay behavior.
- Add queue persistence and idempotency.
- Reduce Cat compatibility wrappers.
- Refresh release notes before the next tagged release.

## Recommendation

GO with caution.

Asteria is architecturally healthier than in Review 001. Sprint 36-39 foundations were added in a provider-neutral way, and Sprint 39 reduced retry duplication. The next sprint may proceed after Founder approval, but production integrations should remain guarded until queue transition policy, audit policy, and dependency checks are tightened.
