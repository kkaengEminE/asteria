# Persistence Architecture Planning

Sprint 49 defined the future persistence architecture for Asteria. Sprint 50 turned that architecture into provider-neutral TypeScript ports. Sprint 51 migrates existing in-memory operational services onto those ports. This document still does not select a database, add schema files, add filesystem storage, run migrations, change runtime behavior, or introduce external services.

## Goals

- Keep persistence provider-neutral.
- Preserve clean architecture boundaries.
- Let Queue, Scheduler, Audit, Metrics, Asset Catalog, and Storage metadata become durable without leaking database details into domain models or workflows.
- Define repository ports before choosing adapters.
- Define transaction, locking, idempotency, and migration policies before production persistence work.

## Non-Goals

- No SQLite, PostgreSQL, Prisma, Drizzle, filesystem persistence, or database setup.
- No durable persistence implementation.
- No runtime behavior changes.
- No production publishing enablement.
- No external API calls.

## Layer Boundary

Persistence should be introduced as ports plus adapters.

Recommended dependency direction:

```text
domain -> service contracts -> repository ports -> persistence adapters
```

Domain models must not import persistence adapters, database clients, ORM models, SQL records, storage SDK records, or filesystem paths.

Services may depend on repository ports. Runtime composition may choose an in-memory adapter for dry runs or a future durable adapter for production.

Provider adapters should not become persistence owners unless they are adapting an external storage system behind an existing provider boundary.

## Repository Interfaces

Repository ports should live near the service boundary that owns the behavior. They should expose domain models and provider-neutral query objects only.

Implemented repository and orchestration ports:

- `PublishingQueueRepository`
- `SchedulerRepository`
- `JobExecutionRepository`
- `AuditStore`
- `MetricsStore`
- `AssetCatalogRepository`
- `StorageMetadataRepository`
- `IdempotencyStore`
- `LockManager`
- `UnitOfWork`

Repository methods should be explicit and behavior-oriented. Avoid generic persistence APIs such as `save(any)` or exposing query-builder details to services.

Current in-memory adapters:

- `InMemoryPublishingQueueRepository`
- `InMemorySchedulerRepository`
- `InMemoryJobExecutionRepository`
- `InMemoryAuditStore`
- `InMemoryMetricsStore`
- `InMemoryAssetCatalogRepository`
- `InMemoryStorageMetadataRepository`
- `InMemoryIdempotencyStore`
- `InMemoryLockManager`
- `InMemoryUnitOfWork`

These adapters are runtime foundations and test doubles only. They are not durable storage and must not be treated as a production persistence layer.

### PublishingQueueRepository

Owns durable queue item state.

Suggested operations:

- `create(item)`
- `getById(id)`
- `list(query)`
- `updateStatus(id, transition)`
- `recordFailure(id, failure)`
- `cancel(id, reason)`
- `findByIdempotencyKey(key)`

The queue service remains responsible for approval checks and transition policy. The repository stores accepted state and enforces optimistic concurrency where available.

### SchedulerRepository

Owns durable scheduled job metadata.

Suggested operations:

- `create(job)`
- `getById(id)`
- `list(query)`
- `findActiveByQueueItemId(queueItemId)`
- `reschedule(id, policy)`
- `cancel(id, reason)`
- `markCompleted(id)`

Scheduler does not execute publishing. It only persists schedule metadata and operational state.

### JobExecutionRepository

Owns durable execution attempts.

Suggested operations:

- `createExecution(execution)`
- `getById(id)`
- `findActiveByJobId(jobId)`
- `recordSuccess(id, result)`
- `recordFailure(id, failure)`
- `recordSkipped(id, reason)`

Executor owns execution orchestration. Repository stores execution records and duplicate-execution markers.

### AuditStore

Owns append-only audit events.

Suggested operations:

- `append(event)`
- `list(query)`
- `filterByEntity(entityType, entityId)`
- `filterByEventType(type)`

Audit events should be append-only. Corrections should be new events, not updates.

### MetricsStore

Owns metric counters, durations, failures, and snapshots.

Suggested operations:

- `incrementCounter(event)`
- `recordDuration(event)`
- `recordFailure(event)`
- `snapshot(query)`

Metrics are observational and may be aggregated. They must not become the source of truth for queue, scheduler, or audit state.

### AssetCatalogRepository

Owns durable asset metadata.

Suggested operations:

- `register(asset)`
- `getById(id)`
- `findByChecksum(checksum)`
- `list(query)`
- `updateMetadata(id, metadata)`
- `deactivate(id, reason)`

Asset Catalog owns editorial asset metadata. StorageProvider owns byte transfer.

### StorageMetadataRepository

Owns provider-neutral metadata for stored files and folders.

Suggested operations:

- `recordFile(metadata)`
- `getFile(id)`
- `listFiles(query)`
- `recordFolder(folder)`
- `getFolder(id)`

It must not expose Google Drive, S3, local filesystem, or SDK-specific records.

### IdempotencyStore

Owns idempotency keys for commands that must not be repeated accidentally.

Suggested operations:

- `claim(key, scope)`
- `complete(key, resultReference)`
- `fail(key, failure)`
- `get(key, scope)`

Idempotency keys should be scoped by operation type, magazine, entity, and destination where relevant.

### LockManager

Owns coarse-grained operational locks.

Suggested operations:

- `acquire(lockKey, owner, ttl)`
- `renew(lockKey, owner, ttl)`
- `release(lockKey, owner)`
- `get(lockKey)`

Locks protect concurrent queue processing and scheduled execution. They should use short TTLs and must not replace idempotency.

### UnitOfWork

Owns transaction boundaries across multiple repositories.

Suggested operation:

- `runInTransaction(callback)`

The UnitOfWork should be optional for in-memory adapters and required for durable adapters that need atomic multi-entity changes.

## Persistence Boundaries

### Queue

PublishingQueue owns approval gate results, destination, status, transition history, and failure records.

Persistence boundary:

- Service depends on `PublishingQueueRepository`.
- Repository stores `PublishingQueueItem` and related failure metadata.
- Queue transition rules remain in the queue service/domain policy.

Sprint 51 status:

- PublishingQueue composes through `PublishingQueueRepository`.
- Current runtime uses `InMemoryPublishingQueueRepository`.
- The previous storage constructor path remains as a compatibility wrapper only.

### Scheduler

Scheduler owns scheduled job metadata, schedule policies, duplicate active job detection, cancellation, rescheduling, and completed-job immutability.

Persistence boundary:

- SchedulerService depends on `SchedulerRepository`.
- ScheduledJobExecutor depends on `JobExecutionRepository`.
- Queue status updates should occur through PublishingQueue service inside a UnitOfWork when durable persistence exists.

Sprint 51 status:

- SchedulerService composes through `SchedulerRepository`.
- ScheduledJobExecutor composes through `JobExecutionRepository`.
- ScheduledJobExecutor uses `IdempotencyStore` and `LockManager` for duplicate execution prevention.
- UnitOfWork remains deferred for scheduler/queue cross-port atomicity until durable persistence exists.

### Audit

AuditLog owns event append and query behavior.

Persistence boundary:

- AuditLog depends on `AuditStore`.
- Events are append-only.
- Workflows and services should depend on AuditLog or a smaller AuditRecorder facade, not on persistence adapters.

Sprint 51 status:

- AuditLog composes with `AuditStore`.
- Current runtime uses `InMemoryAuditStore`.
- AuditLog preserves its existing synchronous public API through an in-memory compatibility cache while durable async store design remains deferred.

Future async direction:

- Keep current synchronous AuditLog API until durable storage is introduced.
- Before durable AuditStore adoption, split write behavior behind an async `AuditRecorder` or make append/query APIs explicitly async.
- Durable audit failures must be visible to callers in operations where audit trail completeness is required.
- Audit events remain append-only; corrections must be additional events.

### Metrics

MetricsService owns observational counters, durations, failures, and snapshots.

Persistence boundary:

- MetricsService depends on `MetricsStore`.
- Metrics may be eventually consistent.
- Metrics should never drive queue or scheduler decisions.

Sprint 51 status:

- MetricsService composes with `MetricsStore`.
- Current runtime uses `InMemoryMetricsStore`.
- MetricsService preserves its existing synchronous public API while recording through the store boundary.

Future async direction:

- Treat metrics as observational and eventually consistent unless a future sprint explicitly requires durable metric guarantees.
- Before durable MetricsStore adoption, decide whether MetricsService becomes async or whether durable metrics are exported by a separate async recorder.
- Metrics write failures must not change queue, scheduler, executor, publisher, or approval decisions.
- Snapshots may remain in-memory for dry-run reporting while durable metrics are exported separately.

### Assets

AssetLibrary owns asset catalog behavior and uses StorageProvider for bytes.

Persistence boundary:

- AssetLibrary depends on `AssetCatalogRepository`.
- Storage metadata can be recorded through `StorageMetadataRepository`.
- StorageProvider remains responsible for upload/download/list/folder operations.

Sprint 51 status:

- AssetLibrary composes through `AssetCatalogRepository`.
- Current runtime uses `InMemoryAssetCatalogRepository`.
- Storage metadata can be recorded through `InMemoryStorageMetadataRepository` when provided.

### Storage Metadata

Storage metadata records provider-neutral file and folder references.

Persistence boundary:

- Storage metadata repository stores normalized references.
- Provider-specific file IDs may appear only inside provider metadata fields, not as workflow assumptions.

## Transaction Ownership

Transactions should be owned by application services, not domain models and not adapters.

Initial transaction boundaries:

- Queue enqueue: create queue item and append queue audit event.
- Queue status update: update queue item and append audit/metrics records.
- Schedule creation: create scheduled job, update queue status to `SCHEDULED`, append audit, record metrics.
- Schedule cancellation: cancel job, update queue item if needed, append audit, record metrics.
- Job execution start: claim lock, create execution record, transition queue to `PROCESSING`, append audit.
- Job execution result: record execution result, append audit, record metrics.
- Asset registration: register asset metadata and record storage metadata.

Audit and metrics may be written in the same transaction when correctness requires a complete operational trail. Metrics can be eventually consistent if a future adapter makes that tradeoff explicit.

## Locking Strategy

Use optimistic concurrency for ordinary entity updates and short-lived locks for execution.

Recommended policies:

- Queue items use version or updated-at checks for status transitions.
- Scheduled jobs use unique active constraints by queue item and destination.
- Job execution uses a lock key such as `scheduled-job:{jobId}:execution`.
- Lock TTL should be short and renewable by the executor.
- Lock loss should produce a skipped or failed execution result, not duplicate publishing.
- Terminal states such as `PUBLISHED`, `CANCELLED`, and completed scheduler jobs remain immutable.

Locking is not a substitute for idempotency. Both are required before real scheduled publishing.

## Idempotency Policy

Idempotency prevents duplicate side effects.

Required key scopes:

- Queue enqueue: magazine, topic or package id, destination, prompt version.
- Schedule creation: queue item id and scheduled time.
- Job execution: scheduled job id and execution window.
- Publisher dispatch: queue item id, scheduled job id, destination, publisher.
- Asset registration: checksum, filename, source provider.
- Audit append: event id.

Policy:

- Commands that may be retried must accept or derive an idempotency key.
- Repeated completed commands should return the original result reference.
- Repeated in-flight commands should return a clear in-progress result.
- Failed commands may be retried only when the failure is marked retryable.

## Migration Strategy

Future persistence migrations should be explicit, versioned, and reversible where practical.

Recommended rules:

- Start with repository ports and in-memory adapters unchanged.
- Add durable adapters behind the ports in a later sprint.
- Introduce schema versions in documentation before creating migration files.
- Keep migrations additive whenever possible.
- Backfill derived read models through explicit maintenance commands, not service constructors.
- Keep domain model evolution separate from database schema evolution.
- Never require a migration to enable publishing automatically.

Migration ownership belongs to persistence adapters and release operations, not domain or workflow code.

## Lifecycle Design

### Queue Lifecycle

1. PublishingPackage receives approval metadata.
2. Queue service validates approval.
3. Approved package is enqueued with status `PENDING` or rejected with a queue failure.
4. Queue transitions are guarded by policy.
5. Scheduler may move approved queue items to `SCHEDULED`.
6. Executor may move scheduled queue items to `PROCESSING`.
7. Real publishing may later move processing items to `PUBLISHED` or `FAILED`.
8. Terminal states remain immutable except explicit failed retry to `PENDING`.

### Scheduler Lifecycle

1. Scheduler receives an approved queue item and schedule policy.
2. Scheduler checks duplicates and schedule validity.
3. Scheduler creates a scheduled job and marks queue item `SCHEDULED`.
4. Scheduler may reschedule or cancel active jobs.
5. Completed jobs are immutable.
6. Executor reads due jobs but does not own schedule creation.

### Audit Lifecycle

1. Services append audit events for meaningful decisions and operations.
2. Events are immutable and queryable by entity and event type.
3. Redaction and retention policies must be defined before production data is stored.
4. Corrections are appended as new events.

### Metrics Lifecycle

1. Services record counters, durations, and failures.
2. Metrics snapshots are generated for review.
3. Metrics may be aggregated or exported later.
4. Metrics do not decide workflow outcomes.

### Asset Lifecycle

1. Asset bytes are uploaded or referenced through StorageProvider.
2. AssetLibrary registers provider-neutral asset metadata.
3. Storage metadata records file/folder references.
4. Asset metadata can be updated without changing stored bytes.
5. Assets may be deactivated instead of deleted for auditability.

### Storage Metadata Lifecycle

1. StorageProvider completes a storage operation.
2. Storage metadata repository records provider-neutral file/folder metadata.
3. Asset Catalog references storage metadata through storage references.
4. Provider-specific IDs stay inside metadata fields.

## Implemented in Sprint 50

- TypeScript ports under `src/services/persistence`.
- Shared provider-neutral persistence types for revisions, pagination, transaction context, lock tokens, idempotency records, and failures.
- Small in-memory proof adapters for `IdempotencyStore`, `LockManager`, and `UnitOfWork`.
- Tests for port shape, optimistic revision handling, idempotency claim/complete/fail, lock acquire/renew/release/expiry, and UnitOfWork commit/rollback behavior.

## Implemented in Sprint 51

- In-memory adapters for Queue, Scheduler, Job Execution, Audit, Metrics, Asset Catalog, and Storage Metadata ports.
- PublishingQueue migration to `PublishingQueueRepository`.
- SchedulerService migration to `SchedulerRepository`.
- ScheduledJobExecutor execution record migration to `JobExecutionRepository`.
- ScheduledJobExecutor duplicate execution path using `IdempotencyStore` and `LockManager`.
- AuditLog composition through `AuditStore`.
- MetricsService composition through `MetricsStore`.
- AssetLibrary metadata composition through `AssetCatalogRepository`.
- Optional StorageMetadataRepository recording for asset-backed storage metadata.
- Architecture boundary coverage preventing workflows from importing concrete persistence adapters.
- Regression coverage for dry-run and Quality Lab compatibility.

## Implemented in Architecture Cleanup Patch 006

- PersistenceCompositionFactory for explicit runtime ownership of repositories, stores, lock manager, idempotency store, and UnitOfWork.
- Operational service constructors no longer instantiate default persistence adapters internally.
- Magazine dry-run runtime composes queue, scheduler, executor, audit, and metrics through a shared persistence composition.
- ScheduledJobExecutor finalizes idempotency and releases locks on post-claim skip, failure, and unexpected-error paths.
- Architecture boundary coverage prevents operational services from directly instantiating concrete in-memory persistence adapters.
- Future async direction for Audit and Metrics is documented without changing public APIs.

## Accepted Deferrals

- No database adapter is selected.
- No schema or migration file is created.
- No persistence configuration or environment variables are added.
- No filesystem persistence is introduced.
- No durable runtime data exists beyond process memory.
- UnitOfWork is not applied broadly because no current migrated operation materially requires multi-port atomicity without durable storage.
- Compatibility wrappers remain for older storage constructor paths where removing them would create behavior churn.

## Future Sprint Candidates

1. Durable Queue Adapter Sprint: add first durable queue adapter behind the repository port.
2. AuditStore Sprint: add durable append-only audit storage behind AuditLog.
3. Asset Catalog Persistence Sprint: add durable asset metadata catalog behind AssetLibrary.
4. Scheduler Persistence Sprint: persist scheduled jobs and execution records.
5. Migration Tooling Sprint: choose and introduce migration tooling after repository ports stabilize.
