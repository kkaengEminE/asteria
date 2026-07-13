# Architecture Review 003

Review date: 2026-07-13

Scope: Post-Sprint 47 architecture review, covering preview growth, transformation services, scheduler/queue/publisher relationships, and dry-run runtime scalability.

## Health Score

86 / 100

## Strengths

- Provider-neutral boundaries remain mostly intact.
- Domain modules do not import workflows, runtime, providers, or services.
- Provider adapters remain isolated behind provider-neutral contracts.
- Magazine runtime continues to act as the composition root.
- Queue, Scheduler, Executor, and PublisherService are separated by responsibility.
- Instagram and Podcast preview services are transformation layers only; they do not post, synthesize audio, publish, persist, or call external APIs.
- Architecture boundary guard continues to detect provider leakage and relative import cycles.

## Risks

- `DryRunResult` was becoming a broad reporting DTO as each new preview channel added another top-level field.
- Dry-run CLI formatting was concentrated in a single script, making output changes brittle.
- Magazine runtime step composition was concentrated in one large file.
- Future transformation channels such as YouTube, LinkedIn, Threads, newsletter, or short-form video could repeat the same growth pattern.
- Older `src/core` contracts still overlap with newer domain/provider models.

## Immediate Actions

- Introduce a provider-neutral preview aggregation model before adding more channels.
- Move channel previews into a typed `previewReport.channels` collection.
- Split CLI dry-run formatting into section-specific formatters.
- Split dry-run runtime step composition into concern-based groups.
- Preserve current dry-run CLI output and magazine behavior while reducing internal coupling.

## Accepted Deferrals

- Do not retire `src/core` contracts in this cleanup patch.
- Do not remove legacy article and SEO preview steps yet.
- Do not add new transformation channels.
- Do not introduce persistence for preview reports, queue, scheduler, audit, metrics, or assets.
- Do not modify locked ADR documents.

## Next Review Targets

- Retire or migrate duplicated `src/core` publishing/provider contracts.
- Continue reducing `DryRunResult` top-level compatibility fields once callers move to `previewReport`.
- Consider a shared channel preview registration pattern before adding YouTube, LinkedIn, Threads, or newsletter previews.
- Review whether legacy `Generate Article` and `Generate SEO` preview steps are still necessary now that PublishingPackage is the source of truth.
- Review persistence and idempotency boundaries before production scheduler operations.
