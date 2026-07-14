import type { AssetCatalogRepository } from './AssetCatalogRepository.ts';
import type { AuditStore } from './AuditStore.ts';
import type { IdempotencyStore } from './IdempotencyStore.ts';
import type { JobExecutionRepository } from './JobExecutionRepository.ts';
import type { LockManager } from './LockManager.ts';
import type { MetricsStore } from './MetricsStore.ts';
import type { PublishingQueueRepository } from './PublishingQueueRepository.ts';
import type { SchedulerRepository } from './SchedulerRepository.ts';
import type { StorageMetadataRepository } from './StorageMetadataRepository.ts';
import type { UnitOfWork } from './UnitOfWork.ts';
import { InMemoryAssetCatalogRepository } from './inMemory/InMemoryAssetCatalogRepository.ts';
import { InMemoryAuditStore } from './inMemory/InMemoryAuditStore.ts';
import { InMemoryIdempotencyStore } from './inMemory/InMemoryIdempotencyStore.ts';
import { InMemoryJobExecutionRepository } from './inMemory/InMemoryJobExecutionRepository.ts';
import { InMemoryLockManager } from './inMemory/InMemoryLockManager.ts';
import { InMemoryMetricsStore } from './inMemory/InMemoryMetricsStore.ts';
import { InMemoryPublishingQueueRepository } from './inMemory/InMemoryPublishingQueueRepository.ts';
import { InMemorySchedulerRepository } from './inMemory/InMemorySchedulerRepository.ts';
import { InMemoryStorageMetadataRepository } from './inMemory/InMemoryStorageMetadataRepository.ts';
import { InMemoryUnitOfWork } from './inMemory/InMemoryUnitOfWork.ts';

export interface PersistenceComposition {
  publishingQueueRepository: PublishingQueueRepository;
  schedulerRepository: SchedulerRepository;
  jobExecutionRepository: JobExecutionRepository;
  auditStore: AuditStore;
  metricsStore: MetricsStore;
  assetCatalogRepository: AssetCatalogRepository;
  storageMetadataRepository: StorageMetadataRepository;
  idempotencyStore: IdempotencyStore;
  lockManager: LockManager;
  unitOfWork: UnitOfWork;
}

export type PersistenceCompositionMode = 'memory' | 'sqlite' | 'postgresql';

export interface CreatePersistenceCompositionOptions {
  mode?: PersistenceCompositionMode;
  sqliteComposition?: PersistenceComposition;
  postgreSQLComposition?: PersistenceComposition;
}

export function createInMemoryPersistenceComposition(): PersistenceComposition {
  return {
    publishingQueueRepository: new InMemoryPublishingQueueRepository(),
    schedulerRepository: new InMemorySchedulerRepository(),
    jobExecutionRepository: new InMemoryJobExecutionRepository(),
    auditStore: new InMemoryAuditStore(),
    metricsStore: new InMemoryMetricsStore(),
    assetCatalogRepository: new InMemoryAssetCatalogRepository(),
    storageMetadataRepository: new InMemoryStorageMetadataRepository(),
    idempotencyStore: new InMemoryIdempotencyStore(),
    lockManager: new InMemoryLockManager(),
    unitOfWork: new InMemoryUnitOfWork()
  };
}

export function createPersistenceComposition(options: CreatePersistenceCompositionOptions = {}): PersistenceComposition {
  const mode = options.mode ?? 'memory';

  if (mode === 'memory') {
    return createInMemoryPersistenceComposition();
  }

  if (mode === 'sqlite') {
    if (options.sqliteComposition) {
      return options.sqliteComposition;
    }

    throw new Error('SQLite persistence composition requires a SQLite adapter supplied by runtime composition.');
  }

  if (options.postgreSQLComposition) {
    return options.postgreSQLComposition;
  }

  throw new Error('PostgreSQL persistence composition requires a PostgreSQL adapter supplied by runtime composition.');
}
