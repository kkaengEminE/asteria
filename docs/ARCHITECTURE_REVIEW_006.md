# Architecture Review 006

Architecture Review 006 evaluated Asteria after Sprint 55 and before adding a concrete PostgreSQL connection pool.

## Health Score

87 / 100

## Strengths

- Persistence ports remain provider-neutral.
- In-memory remains the default runtime.
- SQLite is explicit local/dev persistence and has operational validation.
- PostgreSQL repository, migration, lock, idempotency, and UnitOfWork boundaries are isolated under `src/providers/persistence/postgresql`.
- Architecture boundary tests prevent workflows and domain modules from importing concrete persistence adapters.

## Weaknesses

- Sprint 55 PostgreSQL support required an injected connection and did not yet include a concrete driver or pool.
- Real PostgreSQL transaction participation had not yet been proven against a concrete pool adapter.
- Persistence health checks and graceful shutdown behavior were not consistently documented.
- Durable Audit and Metrics remain deferred.

## Technical Debt

- Compatibility wrappers remain for older storage constructor paths.
- PostgreSQL migration SQL was adapter-owned but not yet externalized into migration files with checksums.
- Lock cleanup relies on explicit release plus TTL and has no background sweep.

## Immediate Actions

- Implement a concrete PostgreSQL connection/pool adapter.
- Add mocked pool tests for query routing, transactions, health checks, close behavior, and error redaction.
- Wire explicit PostgreSQL runtime composition without making PostgreSQL the default.
- Document environment configuration, lifecycle, and the opt-in smoke test.

## Accepted Deferrals

- Real isolated PostgreSQL operational integration suite remains deferred to Sprint 57.
- Durable AuditStore, MetricsStore, Asset Catalog, and Storage Metadata remain deferred.
- Publishing remains disabled.

## Next Review Targets

- Real PostgreSQL operational validation after Sprint 57.
- Migration file/checksum strategy.
- Persistence health check standardization.
- Shutdown behavior across CLI, future scheduler workers, and future publishing workers.
