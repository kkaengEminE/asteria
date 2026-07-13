import type { TransactionContext } from './PersistenceTypes.ts';

export interface UnitOfWork {
  runInTransaction<T>(callback: (context: TransactionContext) => Promise<T>): Promise<T>;
}

