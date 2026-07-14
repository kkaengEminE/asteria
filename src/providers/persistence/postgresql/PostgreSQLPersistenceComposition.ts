import {
  InMemoryAssetCatalogRepository,
  InMemoryAuditStore,
  InMemoryMetricsStore,
  InMemoryStorageMetadataRepository,
  type PersistenceComposition
} from '../../../services/persistence/index.ts';
import type { PostgreSQLConnection } from './PostgreSQLConnection.ts';
import { PostgreSQLIdempotencyStore } from './PostgreSQLIdempotencyStore.ts';
import { PostgreSQLJobExecutionRepository } from './PostgreSQLJobExecutionRepository.ts';
import { PostgreSQLLockManager } from './PostgreSQLLockManager.ts';
import { migratePostgreSQLDatabase } from './PostgreSQLMigrations.ts';
import { PostgreSQLPublishingQueueRepository } from './PostgreSQLPublishingQueueRepository.ts';
import { PostgreSQLSchedulerRepository } from './PostgreSQLSchedulerRepository.ts';
import { PostgreSQLUnitOfWork } from './PostgreSQLUnitOfWork.ts';

export interface PostgreSQLPersistenceComposition extends PersistenceComposition {
  postgreSQLConnection: PostgreSQLConnection;
}

export interface CreatePostgreSQLPersistenceCompositionOptions {
  connection: PostgreSQLConnection;
  migrate?: boolean;
}

export async function createPostgreSQLPersistenceComposition(
  options: CreatePostgreSQLPersistenceCompositionOptions
): Promise<PostgreSQLPersistenceComposition> {
  const { connection } = options;

  if (options.migrate !== false) {
    await migratePostgreSQLDatabase(connection);
  }

  return {
    publishingQueueRepository: new PostgreSQLPublishingQueueRepository(connection),
    schedulerRepository: new PostgreSQLSchedulerRepository(connection),
    jobExecutionRepository: new PostgreSQLJobExecutionRepository(connection),
    auditStore: new InMemoryAuditStore(),
    metricsStore: new InMemoryMetricsStore(),
    assetCatalogRepository: new InMemoryAssetCatalogRepository(),
    storageMetadataRepository: new InMemoryStorageMetadataRepository(),
    idempotencyStore: new PostgreSQLIdempotencyStore(connection),
    lockManager: new PostgreSQLLockManager(connection),
    unitOfWork: new PostgreSQLUnitOfWork(connection),
    postgreSQLConnection: connection
  };
}
