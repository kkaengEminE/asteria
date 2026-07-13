import type { TransactionContext, UnitOfWork } from '../../../services/persistence/index.ts';
import type { SQLiteDatabase } from './SQLiteConnection.ts';

export class SQLiteUnitOfWork implements UnitOfWork {
  private readonly database: SQLiteDatabase;
  private nextTransactionNumber = 1;
  private inTransaction = false;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  async runInTransaction<T>(callback: (context: TransactionContext) => Promise<T>): Promise<T> {
    if (this.inTransaction) {
      return callback({
        id: `sqlite-tx-${this.nextTransactionNumber++}`,
        metadata: {
          nested: true
        }
      });
    }

    const context: TransactionContext = {
      id: `sqlite-tx-${this.nextTransactionNumber++}`
    };

    this.inTransaction = true;
    this.database.exec('BEGIN IMMEDIATE;');

    try {
      const result = await callback(context);
      this.database.exec('COMMIT;');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK;');
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }
}
