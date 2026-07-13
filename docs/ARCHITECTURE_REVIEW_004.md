# Architecture Review 004

Review date: 2026-07-13

Scope: Post-Sprint 51 review, focused on persistence ports, repository migration, runtime composition, queue, scheduler, executor, publisher, retry, metrics, audit, preview aggregation, provider neutrality, layer boundaries, dependency direction, persistence readiness, and production readiness.

## Health Score

84 / 100

## Strengths

- Domain remains free of provider, workflow, runtime, and persistence adapter imports.
- Workflows do not import concrete providers or concrete persistence adapters.
- Provider adapters do not import workflows or legacy core contracts.
- Queue, Scheduler, Executor, Publisher, Retry, Metrics, and Audit remain separated by responsibility.
- Persistence ports are provider-neutral and database-agnostic.
- Preview aggregation reduced DryRunResult growth risk from Architecture Review 003.
- Publishing remains disabled by default.
- No database, ORM, filesystem persistence, or external API behavior leaked in.

## Weaknesses

- ScheduledJobExecutor could leak lock and idempotency state after lock acquisition on some skip paths.
- Durable persistence needs explicit UnitOfWork boundaries before queue/scheduler/executor writes become durable.
- Services still instantiated concrete in-memory adapters internally before Patch 006.
- AuditLog and MetricsService preserve synchronous public APIs with compatibility caches, which needs explicit future async direction.
- Compatibility storage contracts remain beside repository ports.

## Immediate Actions

- Fix ScheduledJobExecutor lock/idempotency cleanup on all post-claim paths.
- Add a persistence runtime composition factory.
- Move runtime persistence adapter ownership out of operational service constructors.
- Document future async direction for Audit and Metrics.
- Keep durable persistence, database selection, publishing, and external APIs deferred.

## Accepted Deferrals

- Do not introduce durable persistence.
- Do not add database, ORM, SQLite, PostgreSQL, Prisma, Drizzle, or filesystem persistence.
- Do not enable publishing.
- Do not broadly apply UnitOfWork until durable multi-port atomicity exists.
- Keep compatibility storage wrappers where removing them would create behavior churn.

## Next Review Targets

- Verify durable Queue adapter can plug into PersistenceComposition without service constructor changes.
- Decide whether AuditLog should split into async AuditRecorder plus query service.
- Decide whether MetricsService should become async or treat metrics as eventually consistent fire-and-forget signals.
- Retire compatibility storage wrappers after repository-based callers are complete.
- Re-check scheduler/executor UnitOfWork boundaries before real scheduled publishing.
