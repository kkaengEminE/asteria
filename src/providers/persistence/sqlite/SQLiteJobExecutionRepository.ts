import type {
  JobExecutionFailure,
  JobExecutionResult,
  ScheduledJobExecution
} from '../../../domain/scheduler/index.ts';
import type {
  JobExecutionQuery,
  JobExecutionRepository,
  PageResult,
  RevisionCheck,
  Revisioned
} from '../../../services/persistence/index.ts';
import type { SQLiteDatabase, SQLiteRow } from './SQLiteConnection.ts';
import { assertRevision, createRevisioned, pageItems, parseJson, stringifyJson } from './SQLiteSerialization.ts';

export class SQLiteJobExecutionRepository implements JobExecutionRepository {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  async createExecution(execution: ScheduledJobExecution): Promise<Revisioned<ScheduledJobExecution>> {
    const existing = await this.getById(execution.id);

    if (existing) {
      return this.updateExecution(execution, existing.revision + 1);
    }

    const revision = 1;
    this.database.prepare(`
      INSERT INTO job_executions (
        id, job_id, queue_item_id, status, data_json, revision, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      execution.id,
      execution.jobId,
      execution.queueItemId ?? null,
      execution.status,
      stringifyJson(execution),
      revision,
      execution.startedAt ?? null,
      execution.completedAt ?? null
    );

    return createRevisioned(execution, revision);
  }

  async getById(id: string): Promise<Revisioned<ScheduledJobExecution> | undefined> {
    const row = this.database.prepare('SELECT data_json, revision FROM job_executions WHERE id = ?').get(id);
    return row ? mapExecutionRow(row) : undefined;
  }

  async list(query: JobExecutionQuery = {}): Promise<PageResult<Revisioned<ScheduledJobExecution>>> {
    const rows = this.database.prepare('SELECT data_json, revision FROM job_executions ORDER BY COALESCE(started_at, completed_at, id) ASC').all();
    const filtered = rows
      .map(mapExecutionRow)
      .filter((record) => !query.jobId || record.value.jobId === query.jobId)
      .filter((record) => !query.queueItemId || record.value.queueItemId === query.queueItemId)
      .filter((record) => !query.status || record.value.status === query.status);

    return pageItems(filtered, query);
  }

  async findActiveByJobId(jobId: string): Promise<Revisioned<ScheduledJobExecution> | undefined> {
    const row = this.database
      .prepare("SELECT data_json, revision FROM job_executions WHERE job_id = ? AND status IN ('RUNNING', 'SUCCEEDED') LIMIT 1")
      .get(jobId);
    return row ? mapExecutionRow(row) : undefined;
  }

  async recordSuccess(
    id: string,
    result: JobExecutionResult,
    revision?: RevisionCheck
  ): Promise<Revisioned<ScheduledJobExecution>> {
    const current = await this.require(id);
    assertRevision('record', current.revision, revision);
    const execution: ScheduledJobExecution = {
      ...current.value,
      status: 'SUCCEEDED',
      attemptCount: result.attemptCount,
      retryCount: result.retryCount,
      completedAt: current.value.completedAt ?? new Date().toISOString(),
      failure: undefined
    };

    return this.updateExecution(execution, current.revision + 1);
  }

  async recordFailure(
    id: string,
    failure: JobExecutionFailure,
    revision?: RevisionCheck
  ): Promise<Revisioned<ScheduledJobExecution>> {
    const current = await this.require(id);
    assertRevision('record', current.revision, revision);
    const execution: ScheduledJobExecution = {
      ...current.value,
      status: 'FAILED',
      completedAt: current.value.completedAt ?? new Date().toISOString(),
      failure
    };

    return this.updateExecution(execution, current.revision + 1);
  }

  async recordSkipped(id: string, reason: string, revision?: RevisionCheck): Promise<Revisioned<ScheduledJobExecution>> {
    const current = await this.require(id);
    assertRevision('record', current.revision, revision);
    const execution: ScheduledJobExecution = {
      ...current.value,
      status: 'SKIPPED',
      completedAt: current.value.completedAt ?? new Date().toISOString(),
      failure: current.value.failure ?? {
        code: 'execution_skipped',
        reason,
        retryable: false
      }
    };

    return this.updateExecution(execution, current.revision + 1);
  }

  private async require(id: string): Promise<Revisioned<ScheduledJobExecution>> {
    const record = await this.getById(id);

    if (!record) {
      throw new Error(`Scheduled job execution was not found: ${id}.`);
    }

    return record;
  }

  private updateExecution(execution: ScheduledJobExecution, revision: number): Revisioned<ScheduledJobExecution> {
    const result = this.database.prepare(`
      UPDATE job_executions
      SET job_id = ?, queue_item_id = ?, status = ?, data_json = ?, revision = ?, started_at = ?, completed_at = ?
      WHERE id = ?
    `).run(
      execution.jobId,
      execution.queueItemId ?? null,
      execution.status,
      stringifyJson(execution),
      revision,
      execution.startedAt ?? null,
      execution.completedAt ?? null,
      execution.id
    );

    if (result.changes !== 1) {
      throw new Error(`Scheduled job execution was not found: ${execution.id}.`);
    }

    return createRevisioned(execution, revision);
  }
}

function mapExecutionRow(row: SQLiteRow): Revisioned<ScheduledJobExecution> {
  return createRevisioned(parseJson<ScheduledJobExecution>(row.data_json), row.revision);
}
