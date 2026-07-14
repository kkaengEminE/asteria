# PostgreSQL Readiness Plan

This plan prepares Asteria for a future PostgreSQL operational persistence adapter. It does not implement PostgreSQL, add a database dependency, enable publishing, or change runtime behavior.

## Goal

PostgreSQL is the production-target durable adapter after SQLite validates operational persistence locally. Implementation remains blocked until Architecture Cleanup Patch 007 passes and is accepted.

The future PostgreSQL adapter should implement the same provider-neutral ports already used by SQLite:

- `PublishingQueueRepository`
- `SchedulerRepository`
- `JobExecutionRepository`
- `IdempotencyStore`
- `LockManager`
- `UnitOfWork`

Audit, Metrics, Asset Catalog, and Storage Metadata remain deferred unless a later sprint explicitly expands the scope.

## Non-Goals

- No PostgreSQL implementation in this planning step.
- No ORM selection.
- No Prisma or Drizzle.
- No production publishing.
- No external scheduler.
- No real WordPress execution.
- No durable Audit, Metrics, Asset Catalog, or Storage Metadata.

## Adapter Boundary

Future PostgreSQL code should live under a provider adapter boundary such as:

```text
src/providers/persistence/postgres/
```

PostgreSQL-specific details must stay inside the adapter:

- connection pooling
- SQL statements
- migrations
- row records
- error code mapping
- lock behavior
- transaction implementation
- serialization and deserialization

Services, workflows, runtime steps, and domain models must continue to depend only on provider-neutral persistence ports.

## Runtime Configuration

Future configuration should extend the existing persistence mode pattern.

Suggested variables:

```text
ASTERIA_PERSISTENCE_MODE=memory|sqlite|postgres
ASTERIA_POSTGRES_CONNECTION_URL=
ASTERIA_POSTGRES_SSL_MODE=disable|require|verify-full
ASTERIA_POSTGRES_SCHEMA=asteria
```

Rules:

- `memory` remains the default.
- `postgres` must be explicit.
- Missing connection configuration must fail before workflow execution.
- Production publishing must remain disabled independently of persistence mode.
- Secrets must come from environment variables only and must not appear in dry-run output.

## Initial Implementation Scope

The first PostgreSQL implementation should mirror the proven SQLite operational scope:

1. Queue items
2. Scheduled jobs
3. Job executions
4. Idempotency records
5. Execution locks
6. Schema migrations

Do not migrate Audit, Metrics, Asset Catalog, or Storage Metadata in the first PostgreSQL sprint unless a new architecture review explicitly changes the sequence.

## Schema Targets

The PostgreSQL schema should preserve provider-neutral ownership while using stronger production constraints.

### publishing_queue_items

Required behavior:

- primary key by queue item id
- status index
- destination type index
- magazine slug index when present
- revision integer for optimistic updates
- JSONB column for serialized provider-neutral queue item

Recommended constraints:

- `status` limited to known queue statuses
- partial indexes for active queue states if query pressure requires it

### scheduled_jobs

Required behavior:

- primary key by job id
- queue item id index
- status index
- scheduled_for index
- revision integer for optimistic updates
- JSONB column for serialized provider-neutral scheduled job

Recommended constraints:

- unique active scheduled job by queue item where status is `SCHEDULED`
- scheduled_for stored as timestamptz

### job_executions

Required behavior:

- primary key by execution id
- job id index
- queue item id index
- status index
- revision integer for optimistic updates
- JSONB column for serialized provider-neutral execution record

Recommended constraints:

- unique active execution by job id where status is `RUNNING`
- completed_at nullable until terminal state

### idempotency_records

Required behavior:

- composite primary key on scope and key
- status index
- updated_at index
- JSONB failure metadata
- result reference

Recommended constraints:

- scope and key must be non-empty
- completed records should not be overwritten by a new claim

### execution_locks

Required behavior:

- primary key by lock key
- owner field
- expires_at field
- acquired_at and updated_at fields

Recommended constraints:

- expired locks may be claimed by a new owner inside a transaction
- release must validate token identity or owner identity

### schema_migrations

Required behavior:

- migration version primary key
- applied_at timestamp
- checksum or name field when migration files exist

Rules:

- Unsupported future schema versions must fail startup.
- No automatic destructive rollback.
- Forward migrations should be additive when possible.

## Transaction Ownership

PostgreSQL should respect the service-owned transaction boundaries already documented in `docs/PERSISTENCE_ARCHITECTURE.md`.

Required transaction boundaries:

- schedule creation: queue `SCHEDULED` transition plus scheduled job creation
- execution start: idempotency claim, execution record creation, queue `PROCESSING` transition
- execution success: execution completion, idempotency completion, lock release
- execution failure: execution failure record, queue failure when applicable, idempotency failure, lock release

PostgreSQL `UnitOfWork` should own transaction lifecycle. Repositories must participate in the active transaction without exposing transaction handles to domain models or workflows.

## Concurrency Strategy

PostgreSQL should preserve the existing provider-neutral conflict behavior.

Required:

- atomic updates using `UPDATE ... WHERE id = $1 AND revision = $2`
- map zero-row stale updates to `PersistenceRevisionConflictError`
- no silent overwrite of newer queue, scheduler, or execution records
- retry only when the calling service classifies the operation as retryable

Recommended:

- use unique constraints for active scheduler and execution guards
- use short transactions
- avoid holding locks across provider network calls
- keep publisher dispatch retry-safe with idempotency records

## Locking Strategy

The first PostgreSQL adapter should use table-backed locks to preserve parity with the existing `LockManager` port.

Recommended first implementation:

- acquire by inserting a lock row or replacing an expired lock row in one transaction
- renew only if the token/owner matches
- release only if the token/owner matches
- treat lock acquisition failure as an in-progress/duplicate execution outcome

PostgreSQL advisory locks may be evaluated later, but table-backed locks are easier to test through the current provider-neutral `LockManager` behavior.

## Migration Strategy

PostgreSQL migrations should be explicit SQL files owned by the adapter.

Suggested layout:

```text
src/providers/persistence/postgres/migrations/
0001_create_operational_persistence.sql
```

Rules:

- Apply migrations at adapter startup only when PostgreSQL mode is explicitly selected.
- Verify schema version before service composition.
- Do not run destructive rollback automatically.
- Keep SQLite and PostgreSQL schemas behaviorally compatible even when SQL syntax differs.
- Document manual backup and restore expectations before production use.

## Test Strategy

Future PostgreSQL tests should remain isolated and must not depend on developer machine state.

Required test categories:

- configuration disabled/default behavior
- missing connection configuration error
- migration startup
- repeated migration startup
- unsupported future schema version failure
- queue persistence
- scheduler persistence
- execution persistence
- idempotency persistence
- lock acquire, renew, release, and expiry
- stale revision conflicts
- schedule creation transaction rollback
- execution start transaction rollback
- executor duplicate prevention
- architecture boundary compliance
- dry-run memory mode regression

Integration tests may require an explicit environment flag or a test container strategy in a later implementation sprint. Unit tests should use mocked PostgreSQL transport/connection behavior where practical.

## Production Readiness Gates

Before PostgreSQL can be considered production-ready:

- Architecture Cleanup Patch 007 is accepted.
- In-memory remains default.
- PostgreSQL mode is explicit.
- All operational migrations are repeatable.
- Transaction boundaries are validated under concurrency.
- Locks and idempotency are validated with restart scenarios.
- No external publish operation can run unless publishing is separately enabled.
- Secrets never appear in logs, dry-run output, or reports.
- Backup, restore, migration, and rollback policies are documented.

## Recommended Next Implementation Sprint

Implement the PostgreSQL Operational Persistence Adapter with the same narrow scope as SQLite:

- Queue
- Scheduler
- Job Execution
- Idempotency
- Locks
- UnitOfWork

Do not expand the first PostgreSQL sprint into Audit, Metrics, Asset Catalog, Storage Metadata, publishing, or external scheduler execution.
