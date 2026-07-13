import type { TransactionContext } from '../PersistenceTypes.ts';
import type { UnitOfWork } from '../UnitOfWork.ts';

export class InMemoryUnitOfWork implements UnitOfWork {
  private nextTransactionNumber = 1;
  readonly commits: TransactionContext[] = [];
  readonly rollbacks: TransactionContext[] = [];

  async runInTransaction<T>(callback: (context: TransactionContext) => Promise<T>): Promise<T> {
    const context: TransactionContext = {
      id: `tx-${this.nextTransactionNumber++}`
    };

    try {
      const result = await callback(context);
      this.commits.push(context);

      return result;
    } catch (error) {
      this.rollbacks.push(context);
      throw error;
    }
  }
}

