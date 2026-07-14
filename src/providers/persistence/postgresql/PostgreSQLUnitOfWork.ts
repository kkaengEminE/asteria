import type { TransactionContext, UnitOfWork } from '../../../services/persistence/index.ts';
import type { PostgreSQLConnection } from './PostgreSQLConnection.ts';

export class PostgreSQLUnitOfWork implements UnitOfWork {
  private readonly connection: PostgreSQLConnection;
  private nextTransactionNumber = 1;
  private inTransaction = false;

  constructor(connection: PostgreSQLConnection) {
    this.connection = connection;
  }

  async runInTransaction<T>(callback: (context: TransactionContext) => Promise<T>): Promise<T> {
    if (this.inTransaction) {
      return callback({
        id: `postgresql-tx-${this.nextTransactionNumber++}`,
        metadata: {
          nested: true
        }
      });
    }

    const context: TransactionContext = {
      id: `postgresql-tx-${this.nextTransactionNumber++}`
    };

    this.inTransaction = true;

    try {
      return await this.connection.transaction(() => callback(context));
    } finally {
      this.inTransaction = false;
    }
  }
}
