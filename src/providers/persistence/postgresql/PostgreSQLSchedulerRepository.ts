import type { SchedulePolicy, ScheduledJob } from '../../../domain/scheduler/index.ts';
import type {
  PageResult,
  RevisionCheck,
  Revisioned,
  SchedulerQuery,
  SchedulerRepository
} from '../../../services/persistence/index.ts';
import type { PostgreSQLConnection, PostgreSQLRow } from './PostgreSQLConnection.ts';
import { assertRevision, createRevisionConflict, createRevisioned, pageItems, parseJson, stringifyJson } from './PostgreSQLSerialization.ts';

export class PostgreSQLSchedulerRepository implements SchedulerRepository {
  private readonly connection: PostgreSQLConnection;

  constructor(connection: PostgreSQLConnection) {
    this.connection = connection;
  }

  async create(job: ScheduledJob): Promise<Revisioned<ScheduledJob>> {
    const revision = 1;
    await this.connection.query(`
      INSERT INTO scheduled_jobs (
        id, queue_item_id, status, scheduled_for, data_json, revision, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
    `, [job.id, job.queueItemId, job.status, job.scheduledFor, stringifyJson(job), revision, job.createdAt, job.updatedAt]);

    return createRevisioned(job, revision);
  }

  async getById(id: string): Promise<Revisioned<ScheduledJob> | undefined> {
    const result = await this.connection.query('SELECT data_json, revision FROM scheduled_jobs WHERE id = $1', [id]);
    return result.rows[0] ? mapSchedulerRow(result.rows[0]) : undefined;
  }

  async list(query: SchedulerQuery = {}): Promise<PageResult<Revisioned<ScheduledJob>>> {
    const result = await this.connection.query('SELECT data_json, revision FROM scheduled_jobs ORDER BY created_at ASC');
    const filtered = result.rows
      .map(mapSchedulerRow)
      .filter((record) => !query.status || record.value.status === query.status)
      .filter((record) => !query.queueItemId || record.value.queueItemId === query.queueItemId)
      .filter((record) => !query.dueBefore || Date.parse(record.value.scheduledFor) <= Date.parse(query.dueBefore));

    return pageItems(filtered, query);
  }

  async findActiveByQueueItemId(queueItemId: string): Promise<Revisioned<ScheduledJob> | undefined> {
    const result = await this.connection.query(`
      SELECT data_json, revision FROM scheduled_jobs
      WHERE queue_item_id = $1 AND status = 'SCHEDULED'
      LIMIT 1
    `, [queueItemId]);
    return result.rows[0] ? mapSchedulerRow(result.rows[0]) : undefined;
  }

  async reschedule(id: string, policy: SchedulePolicy, revision?: RevisionCheck): Promise<Revisioned<ScheduledJob>> {
    const current = await this.require(id);
    assertRevision('record', current.revision, revision);
    const now = new Date().toISOString();
    const job: ScheduledJob = {
      ...current.value,
      policy,
      scheduledFor: policy.scheduledFor,
      updatedAt: now,
      metadata: {
        ...current.value.metadata,
        previousScheduledFor: current.value.scheduledFor
      }
    };

    return this.updateJob(job, current.revision);
  }

  async cancel(id: string, reason: string, revision?: RevisionCheck): Promise<Revisioned<ScheduledJob>> {
    const current = await this.require(id);
    assertRevision('record', current.revision, revision);
    const now = new Date().toISOString();
    const job: ScheduledJob = {
      ...current.value,
      status: 'CANCELLED',
      updatedAt: now,
      cancelledAt: now,
      metadata: {
        ...current.value.metadata,
        cancellationReason: reason
      }
    };

    return this.updateJob(job, current.revision);
  }

  async markCompleted(id: string, revision?: RevisionCheck): Promise<Revisioned<ScheduledJob>> {
    const current = await this.require(id);
    assertRevision('record', current.revision, revision);
    const now = new Date().toISOString();
    const job: ScheduledJob = {
      ...current.value,
      status: 'COMPLETED',
      updatedAt: now,
      metadata: {
        ...current.value.metadata,
        completedAt: now
      }
    };

    return this.updateJob(job, current.revision);
  }

  private async require(id: string): Promise<Revisioned<ScheduledJob>> {
    const record = await this.getById(id);

    if (!record) {
      throw new Error(`Scheduled job was not found: ${id}.`);
    }

    return record;
  }

  private async updateJob(job: ScheduledJob, expectedRevision: number): Promise<Revisioned<ScheduledJob>> {
    const result = await this.connection.query(`
      UPDATE scheduled_jobs
      SET queue_item_id = $1,
          status = $2,
          scheduled_for = $3,
          data_json = $4::jsonb,
          revision = revision + 1,
          updated_at = $5
      WHERE id = $6 AND revision = $7
      RETURNING data_json, revision
    `, [job.queueItemId, job.status, job.scheduledFor, stringifyJson(job), job.updatedAt, job.id, expectedRevision]);

    if (result.rows[0]) {
      return mapSchedulerRow(result.rows[0]);
    }

    const revision = await this.getRevision(job.id);
    if (revision !== undefined) {
      throw createRevisionConflict('record', expectedRevision, revision);
    }
    throw new Error(`Scheduled job was not found: ${job.id}.`);
  }

  private async getRevision(id: string): Promise<number | undefined> {
    const result = await this.connection.query('SELECT revision FROM scheduled_jobs WHERE id = $1', [id]);
    return result.rows[0] ? Number(result.rows[0].revision) : undefined;
  }
}

function mapSchedulerRow(row: PostgreSQLRow): Revisioned<ScheduledJob> {
  return createRevisioned(parseJson<ScheduledJob>(row.data_json), row.revision);
}
