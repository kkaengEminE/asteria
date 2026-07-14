# Durable Persistence Adapter Plan

Sprint 52 selected and designed the first durable persistence adapter path for Asteria. Sprint 53 implements the SQLite local/dev operational adapter described here. Architecture Cleanup Patch 007 clarified scheduler/executor transaction ownership after SQLite validation. Sprint 55 implements the initial PostgreSQL operational adapter boundary while keeping in-memory as the default. Sprint 56 adds the concrete `pg` connection/pool adapter for opt-in PostgreSQL runtime composition. Durable Audit, Metrics, Asset Catalog, and Storage Metadata remain deferred. PostgreSQL readiness details are documented in `docs/POSTGRESQL_READINESS_PLAN.md`.

## Decision Summary

Asteria should introduce durable persistence in two adapter tracks:

- Local/dev first adapter: SQLite.
- Production target adapter: PostgreSQL.

The first implementation scope should migrate operational state before observational and catalog state:

1. `PublishingQueueRepository`
2. `SchedulerRepository`
3. `JobExecutionRepository`
4. `IdempotencyStore`
5. `LockManager`

`AuditStore`, `MetricsStore`, and `AssetCatalogRepository` should remain on in-memory adapters until operational queue/scheduler/executor durability is proven.

## Candidate Backend Comparison

### SQLite

Strengths:

- Excellent local development experience.
- Simple single-node deployment.
- No server process required.
- Easy test database lifecycle with disposable files or in-memory databases.
- Good fit for early durable adapter validation.
- Low operational complexity.

Weaknesses:

- Limited concurrent writer throughput.
- Locking is database-file scoped compared with row-level database locks.
- Multi-worker production execution requires careful constraints and timeout handling.
- Cloud deployment is possible but less natural when multiple workers or horizontal scaling are required.

Fit:

- Best first durable adapter for local development, deterministic tests, and single-node proof.
- Not the final production target for concurrent publishing workers.

### PostgreSQL

Strengths:

- Strong production fit for concurrent workers.
- Row-level locking, transactions, unique constraints, and advisory locks are mature.
- Natural support for optimistic revisions, idempotency keys, and scheduler/executor coordination.
- Fits future cloud deployment and managed database operations.
- Better long-term migration, observability, and operational tooling.

Weaknesses:

- More operational complexity than SQLite.
- Requires a running service in development and CI unless containerized.
- Migration lifecycle needs stricter release discipline.
- Slightly heavier first implementation cost.

Fit:

- Best production adapter target.
- Should follow the SQLite adapter after repository behavior and schemas stabilize.

## Recommendation

Use SQLite as the first durable adapter for local development and adapter proof.

Use PostgreSQL as the production adapter target.

Rationale:

- Asteria is still validating persistence boundaries and operational workflows.
- SQLite lets the project prove schema shape, migrations, repository mapping, revision checks, and test lifecycle with low setup cost.
- PostgreSQL should remain the production design target because scheduler execution, publishing dispatch, idempotency, locking, and multi-worker processing will need stronger concurrency primitives.

Sprint 53 implements the SQLite local/dev adapter using Node's built-in SQLite support. Sprint 55 implements the initial PostgreSQL operational adapter boundary with an injectable connection contract. Sprint 56 selects `pg` and adds the concrete PostgreSQL pool connection while keeping PostgreSQL opt-in.

## First Implementation Scope

The first durable adapter sprint should cover the operational path that is most sensitive to process restarts:

- Queue items
- Scheduled jobs
- Execution records
- Idempotency records
- Locks

Sprint 53 implemented this first adapter scope:

- `PublishingQueueRepository`
- `SchedulerRepository`
- `JobExecutionRepository`
- `IdempotencyStore`
- `LockManager`

Deferred from the first durable adapter and still deferred after Sprint 53:

- `AuditStore`
- `MetricsStore`
- `AssetCatalogRepository`
- `StorageMetadataRepository`

Reasoning:

- Queue, Scheduler, and Execution form one operational chain.
- Idempotency and locks are required for retry-safe execution.
- Audit and Metrics are important but can remain observational until the command path is durable.
- Asset metadata has a different lifecycle and should be migrated after operational persistence proves the repository adapter pattern.

## Schema Boundaries

The durable schema should map to current provider-neutral ports and domain models. Database records should not leak into services, workflows, providers, or domain models.

### Queue Items

Owner:

- `PublishingQueueRepository`

Suggested table:

- `publishing_queue_items`

Suggested columns:

- `id`
- `package_id`
- `magazine_id`
- `topic`
- `status`
- `approval_decision`
- `destination_type`
- `destination_name`
- `destination_metadata_json`
- `failure_json`
- `metadata_json`
- `revision`
- `created_at`
- `updated_at`
- `cancelled_at`

Constraints:

- Primary key on `id`.
- Index on `status`.
- Index on `magazine_id`.
- Optional unique idempotency key once enqueue idempotency is added.

### Scheduled Jobs

Owner:

- `SchedulerRepository`

Suggested table:

- `scheduled_jobs`

Suggested columns:

- `id`
- `queue_item_id`
- `status`
- `scheduled_for`
- `timezone`
- `policy_json`
- `destination_type`
- `destination_name`
- `metadata_json`
- `revision`
- `created_at`
- `updated_at`
- `cancelled_at`
- `completed_at`

Constraints:

- Primary key on `id`.
- Index on `status`.
- Index on `scheduled_for`.
- Unique active schedule by `queue_item_id` and destination where status is active.

### Execution Records

Owner:

- `JobExecutionRepository`

Suggested table:

- `scheduled_job_executions`

Suggested columns:

- `id`
- `job_id`
- `queue_item_id`
- `status`
- `due`
- `attempt_count`
- `retry_count`
- `failure_json`
- `result_json`
- `metadata_json`
- `revision`
- `started_at`
- `finished_at`
- `created_at`
- `updated_at`

Constraints:

- Primary key on `id`.
- Index on `job_id`.
- Index on `queue_item_id`.
- Index on `status`.
- Optional unique active execution by `job_id` when status is `RUNNING`.

### Audit Events

Owner:

- `AuditStore`

Suggested table:

- `audit_events`

Suggested columns:

- `id`
- `type`
- `actor_type`
- `actor_id`
- `entity_type`
- `entity_id`
- `message`
- `metadata_json`
- `occurred_at`
- `created_at`

Constraints:

- Primary key on `id`.
- Index on `type`.
- Index on `entity_type`, `entity_id`.
- Append-only policy.

### Metric Events and Snapshots

Owner:

- `MetricsStore`

Suggested tables:

- `metric_events`
- `metric_snapshots`

Suggested `metric_events` columns:

- `id`
- `type`
- `name`
- `value`
- `tags_json`
- `metadata_json`
- `recorded_at`

Suggested `metric_snapshots` columns:

- `id`
- `snapshot_json`
- `window_start`
- `window_end`
- `created_at`

Constraints:

- Index on `type`.
- Index on `name`.
- Index on `recorded_at`.

### Asset Metadata

Owner:

- `AssetCatalogRepository`

Suggested table:

- `assets`

Suggested columns:

- `id`
- `filename`
- `mime_type`
- `size`
- `category`
- `tags_json`
- `metadata_json`
- `storage_reference_json`
- `checksum`
- `status`
- `revision`
- `created_at`
- `updated_at`
- `deactivated_at`

Constraints:

- Primary key on `id`.
- Index on `category`.
- Index on `checksum`.
- Tags can begin as JSON and later move to a join table if query needs justify it.

### Storage Metadata

Owner:

- `StorageMetadataRepository`

Suggested tables:

- `storage_files`
- `storage_folders`

Suggested columns:

- `id`
- `provider`
- `filename` or `folder_name`
- `mime_type`
- `size`
- `uri`
- `metadata_json`
- `created_at`
- `updated_at`

Constraints:

- Primary key on `id`.
- Index on `provider`.
- Provider-specific IDs must remain inside `metadata_json` or provider-owned adapter records, not workflow logic.

### Idempotency Records

Owner:

- `IdempotencyStore`

Suggested table:

- `idempotency_records`

Suggested columns:

- `key`
- `scope`
- `status`
- `result_reference`
- `failure_json`
- `expires_at`
- `created_at`
- `updated_at`

Constraints:

- Primary key on `scope`, `key`.
- Index on `status`.
- Index on `expires_at`.

### Locks

Owner:

- `LockManager`

Suggested table:

- `locks`

Suggested columns:

- `key`
- `owner`
- `expires_at`
- `metadata_json`
- `created_at`
- `updated_at`

Constraints:

- Primary key on `key`.
- Expired locks may be overwritten by a new owner.
- Lock release must validate owner identity.

## Migration Strategy

### Schema Versioning

Use explicit migration versions.

Recommended naming:

```text
0001_create_operational_persistence.sql
0002_add_audit_store.sql
0003_add_asset_catalog.sql
```

Migration version state should be tracked in a `schema_migrations` table when durable adapters are implemented.

Sprint 53 status:

- SQLite tracks version `1` in `schema_migrations`.
- Adapter startup is repeatable.
- Startup fails when the database contains a schema version newer than the adapter supports.
- No automatic destructive rollback is performed.

### Forward Migration

Rules:

- Prefer additive changes.
- Create new nullable fields before requiring them.
- Backfill using explicit maintenance scripts, not service constructors.
- Keep repository interfaces stable while adapter schemas evolve.
- Do not enable publishing as part of any migration.

### Rollback Policy

Rules:

- Support rollback for local/dev migrations where practical.
- For production, prefer forward-fix migrations when data loss would be possible.
- Rollback scripts must never delete operational publishing state without explicit approval.
- Schema rollback must not silently mark jobs as unpublished or re-run work.

### Local Test Database Lifecycle

When the first SQLite adapter is implemented:

- Tests should create an isolated temporary database per test file or suite.
- Migrations should run at setup.
- Test data should be cleared by dropping the temporary database.
- Tests must not depend on developer machine state.
- In-memory adapters must remain available for fast unit tests.

Sprint 53 status:

- SQLite integration tests use isolated temporary database files.
- Normal dry-run remains in-memory by default.
- Explicit SQLite verification uses `ASTERIA_PERSISTENCE_MODE=sqlite` and `ASTERIA_SQLITE_DATABASE_PATH`.

### Compatibility With In-Memory Adapters

In-memory adapters remain the default runtime for dry-run until durable configuration is explicitly introduced.

Compatibility rules:

- Repository port behavior must match in-memory and durable adapters.
- Existing dry-run behavior must not change when durable adapters are added.
- Architecture boundary tests should continue preventing workflows from importing durable adapters.
- Runtime composition chooses persistence implementation.

## Transaction and Concurrency Strategy

### Queue and Scheduler Atomic Operations

Durable adapter implementation should use `UnitOfWork` for operations that span multiple ports.

Required atomic boundaries:

- Schedule creation:
  - verify queue item
  - create scheduled job
  - transition queue item to `SCHEDULED`
  - record audit event when configured as strict

- Schedule cancellation:
  - cancel scheduled job
  - update queue item when required
  - record audit event when configured as strict

- Execution start:
  - acquire execution lock
  - claim idempotency key
  - create execution record
  - transition queue item to `PROCESSING`

- Execution finish:
  - update execution result
  - finalize idempotency
  - release lock
  - record audit/metrics according to durability policy

### Execution Locking

Execution should use both locks and idempotency.

Policy:

- Lock key: `scheduled-job:{jobId}:execution`.
- Lock TTL must be short and renewable.
- Lock release must validate owner.
- If lock acquisition fails, executor skips or returns in-progress status.
- Lock loss after publish dispatch must not duplicate publishing.

SQLite implementation note:

- Use a locks table with unique key and expiry checks.
- Keep writes small and transactions short.

PostgreSQL implementation note:

- Prefer row-level updates with unique constraints for durable lock records.
- Advisory locks may be considered later, but table-backed locks keep the port behavior portable.

### Optimistic Revisions

Mutable records should use revision checks:

- Queue status transition.
- Scheduler reschedule/cancel/complete.
- Execution result update.
- Asset metadata update.

Conflict behavior:

- Return provider-neutral conflict results or errors.
- Do not silently overwrite newer records.
- Retry only when the caller marks the operation retryable.

### Idempotency Keys

Idempotency is required for retry-safe operations.

Initial scopes:

- `queue-enqueue`
- `schedule-create`
- `scheduled-job-execution`
- `publisher-dispatch`

Behavior:

- `claim` creates an in-flight record.
- `complete` stores a result reference.
- `fail` records retryable/non-retryable failure metadata.
- Repeated completed commands return the original result reference.
- Repeated in-flight commands do not execute again.

### Retry-Safe Publisher Dispatch

Future real publishing must dispatch with a publisher idempotency key derived from:

- queue item id
- scheduled job id
- destination
- publisher adapter
- content revision

Publisher dispatch must happen only after:

- queue item is approved
- scheduled job is due
- execution lock is acquired
- execution idempotency claim succeeds
- publishing is explicitly enabled

If a publisher returns an unknown result after a timeout, the execution should remain recoverable and require a provider-specific reconciliation step before retrying a potentially duplicated publish.

## Adapter Introduction Sequence

Recommended future sprint sequence:

1. SQLite Operational Persistence Adapter
   - Status: implemented in Sprint 53 for Queue, Scheduler, Execution, Idempotency, and Locks.

2. Durable AuditStore Adapter
   - Async write decision
   - Append-only query behavior
   - Retention/redaction policy

3. Durable MetricsStore Adapter
   - Event storage or external export decision
   - Snapshot lifecycle

4. Durable AssetCatalog Adapter
   - Asset metadata durability
   - Storage metadata alignment

5. PostgreSQL Operational Persistence Adapter
   - Production-target concurrency
   - Migration parity with SQLite adapter
   - Worker-readiness checks
   - Scope defined in `docs/POSTGRESQL_READINESS_PLAN.md`

## Non-Goals Confirmed

- No PostgreSQL, Prisma, Drizzle, Redis, filesystem persistence, or external database package is added in Sprint 53.
- SQLite is not the default runtime mode.
- No Audit, Metrics, Asset Catalog, or Storage Metadata durable adapter is added.
- No external API is added.
- Publishing remains disabled.
