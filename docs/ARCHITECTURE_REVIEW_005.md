# Architecture Review 005

Architecture Review 005 evaluated Asteria after SQLite operational validation.

## Health Score

88 / 100

## Strengths

- SQLite adapter boundaries remain isolated under `src/providers/persistence/sqlite`.
- Runtime persistence selection is centralized through `PersistenceCompositionFactory`.
- Queue, Scheduler, Executor, Idempotency, and Lock ports stay provider-neutral.
- In-memory runtime remains the default while SQLite is explicit local/dev mode.
- Architecture boundary tests continue to prevent workflow and domain leakage into concrete persistence adapters.

## Risks

- Scheduler and executor transaction ownership needed clearer service-level boundaries before adding PostgreSQL.
- SQLite repository revision checks needed atomic SQL updates to better model concurrent worker behavior.
- Audit and Metrics remain synchronous/in-memory-facing abstractions, which is acceptable for dry-run but will need async direction before durable storage.

## Immediate Actions

- Adopt `UnitOfWork` inside SchedulerService for queue `SCHEDULED` transition plus scheduled job creation.
- Adopt `UnitOfWork` inside ScheduledJobExecutor for execution start, queue `PROCESSING` transition, execution completion, idempotency finalization, and lock release.
- Change SQLite mutable repository updates to `UPDATE ... WHERE id = ? AND revision = ?`.
- Add concurrency and transaction rollback tests around queue, scheduler, and executor paths.

## Accepted Deferrals

- PostgreSQL adapter remains deferred.
- Durable AuditStore, MetricsStore, Asset Catalog, and Storage Metadata remain deferred.
- Publishing remains disabled.
- Compatibility wrappers may remain where removal would create behavior churn.

## Next Review Targets

- PostgreSQL readiness after transaction ownership cleanup.
- Async strategy for durable Audit and Metrics.
- Remaining compatibility wrapper retirement.
- Production publishing readiness once durable operational persistence is proven.
