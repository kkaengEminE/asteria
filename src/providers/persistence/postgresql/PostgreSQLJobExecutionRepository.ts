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
import type { PostgreSQLConnection, PostgreSQLRow } from './PostgreSQLConnection.ts';
import { assertRevision, createRevisionConflict, createRevisioned, pageItems, parseJson, stringifyJson } from './PostgreSQLSerialization.ts';

export class PostgreSQLJobExecutionRepository implements JobExecutionRepository {
  private readonly connection: PostgreSQLConnection;

  constructor(connection: PostgreSQLConnection) {
    this.connection = connection;
  }

  async createExecution(execution: ScheduledJobExecution): Promise<Revisioned<ScheduledJobExecution>> {
    const existing = await this.getById(execution.id);

    if (existing) {
      return this.updateExecution(execution, existing.revision);
    }

    const revision = 1;
    await this.connection.query(`
      INSERT INTO job_executions (
        id, job_id, queue_item_id, status, data_json, revision, started_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
    `, [
      execution.id,
      execution.jobId,
      execution.queueItemId ?? null,
      execution.status,
      stringifyJson(execution),
      revision,
      execution.startedAt ?? null,
      execution.completedAt ?? null
    ]);

    return createRevisioned(execution, revision);
  }

  async getById(id: string): Promise<Revisioned<ScheduledJobExecution> | undefined> {
    const result = await this.connection.query('SELECT data_json, revision FROM job_executions WHERE id = $1', [id]);
    return result.rows[0] ? mapExecutionRow(result.rows[0]) : undefined;
  }

  async list(query: JobExecutionQuery = {}): Promise<PageResult<Revisioned<ScheduledJobExecution>>> {
    const result = await this.connection.query('SELECT data_json, revision FROM job_executions ORDER BY COALESCE(started_at, completed_at, id) ASC');
    const filtered = result.rows
      .map(mapExecutionRow)
      .filter((record) => !query.jobId || record.value.jobId === query.jobId)
      .filter((record) => !query.queueItemId || record.value.queueItemId === query.queueItemId)
      .filter((record) => !query.status || record.value.status === query.status);

    return pageItems(filtered, query);
  }

  async findActiveByJobId(jobId: string): Promise<Revisioned<ScheduledJobExecution> | undefined> {
    const result = await this.connection.query(`
      SELECT data_json, revision FROM job_executions
      WHERE job_id = $1 AND status IN ('RUNNING', 'SUCCEEDED')
      LIMIT 1
    `, [jobId]);
    return result.rows[0] ? mapExecutionRow(result.rows[0]) : undefined;
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

    return this.updateExecution(execution, current.revision);
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

    return this.updateExecution(execution, current.revision);
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

    return this.updateExecution(execution, current.revision);
  }

  private async require(id: string): Promise<Revisioned<ScheduledJobExecution>> {
    const record = await this.getById(id);

    if (!record) {
      throw new Error(`Scheduled job execution was not found: ${id}.`);
    }

    return record;
  }

  private async updateExecution(
    execution: ScheduledJobExecution,
    expectedRevision: number
  ): Promise<Revisioned<ScheduledJobExecution>> {
    const result = await this.connection.query(`
      UPDATE job_executions
      SET job_id = $1,
          queue_item_id = $2,
          status = $3,
          data_json = $4::jsonb,
          revision = revision + 1,
          started_at = $5,
          completed_at = $6
      WHERE id = $7 AND revision = $8
      RETURNING data_json, revision
    `, [
      execution.jobId,
      execution.queueItemId ?? null,
      execution.status,
      stringifyJson(execution),
      execution.startedAt ?? null,
      execution.completedAt ?? null,
      execution.id,
      expectedRevision
    ]);

    if (result.rows[0]) {
      return mapExecutionRow(result.rows[0]);
    }

    const revision = await this.getRevision(execution.id);
    if (revision !== undefined) {
      throw createRevisionConflict('record', expectedRevision, revision);
    }
    throw new Error(`Scheduled job execution was not found: ${execution.id}.`);
  }

  private async getRevision(id: string): Promise<number | undefined> {
    const result = await this.connection.query('SELECT revision FROM job_executions WHERE id = $1', [id]);
    return result.rows[0] ? Number(result.rows[0].revision) : undefined;
  }
}

function mapExecutionRow(row: PostgreSQLRow): Revisioned<ScheduledJobExecution> {
  return createRevisioned(parseJson<ScheduledJobExecution>(row.data_json), row.revision);
}
