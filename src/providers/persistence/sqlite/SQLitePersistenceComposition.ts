import {
  InMemoryAssetCatalogRepository,
  InMemoryAuditStore,
  InMemoryMetricsStore,
  InMemoryStorageMetadataRepository,
  type PersistenceComposition
} from '../../../services/persistence/index.ts';
import { SQLiteConnection } from './SQLiteConnection.ts';
import { SQLiteIdempotencyStore } from './SQLiteIdempotencyStore.ts';
import { SQLiteJobExecutionRepository } from './SQLiteJobExecutionRepository.ts';
import { SQLiteLockManager } from './SQLiteLockManager.ts';
import { migrateSQLiteDatabase } from './SQLiteMigrations.ts';
import { SQLitePublishingQueueRepository } from './SQLitePublishingQueueRepository.ts';
import { SQLiteSchedulerRepository } from './SQLiteSchedulerRepository.ts';
import { SQLiteUnitOfWork } from './SQLiteUnitOfWork.ts';

export interface SQLitePersistenceComposition extends PersistenceComposition {
  sqliteConnection: SQLiteConnection;
}

export interface CreateSQLitePersistenceCompositionOptions {
  databasePath: string;
}

export function createSQLitePersistenceComposition(
  options: CreateSQLitePersistenceCompositionOptions
): SQLitePersistenceComposition {
  const sqliteConnection = new SQLiteConnection(options.databasePath);
  migrateSQLiteDatabase(sqliteConnection.database);

  return {
    publishingQueueRepository: new SQLitePublishingQueueRepository(sqliteConnection.database),
    schedulerRepository: new SQLiteSchedulerRepository(sqliteConnection.database),
    jobExecutionRepository: new SQLiteJobExecutionRepository(sqliteConnection.database),
    auditStore: new InMemoryAuditStore(),
    metricsStore: new InMemoryMetricsStore(),
    assetCatalogRepository: new InMemoryAssetCatalogRepository(),
    storageMetadataRepository: new InMemoryStorageMetadataRepository(),
    idempotencyStore: new SQLiteIdempotencyStore(sqliteConnection.database),
    lockManager: new SQLiteLockManager(sqliteConnection.database),
    unitOfWork: new SQLiteUnitOfWork(sqliteConnection.database),
    sqliteConnection
  };
}
