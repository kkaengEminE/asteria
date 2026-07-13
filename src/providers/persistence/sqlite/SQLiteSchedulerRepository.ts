import type { SchedulePolicy, ScheduledJob } from '../../../domain/scheduler/index.ts';
import type {
  PageResult,
  RevisionCheck,
  Revisioned,
  SchedulerQuery,
  SchedulerRepository
} from '../../../services/persistence/index.ts';
import type { SQLiteDatabase, SQLiteRow } from './SQLiteConnection.ts';
import { assertRevision, createRevisioned, pageItems, parseJson, stringifyJson } from './SQLiteSerialization.ts';

export class SQLiteSchedulerRepository implements SchedulerRepository {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  async create(job: ScheduledJob): Promise<Revisioned<ScheduledJob>> {
    const revision = 1;
    this.database.prepare(`
      INSERT INTO scheduled_jobs (
        id, queue_item_id, status, scheduled_for, data_json, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(job.id, job.queueItemId, job.status, job.scheduledFor, stringifyJson(job), revision, job.createdAt, job.updatedAt);

    return createRevisioned(job, revision);
  }

  async getById(id: string): Promise<Revisioned<ScheduledJob> | undefined> {
    const row = this.database.prepare('SELECT data_json, revision FROM scheduled_jobs WHERE id = ?').get(id);
    return row ? mapSchedulerRow(row) : undefined;
  }

  async list(query: SchedulerQuery = {}): Promise<PageResult<Revisioned<ScheduledJob>>> {
    const rows = this.database.prepare('SELECT data_json, revision FROM scheduled_jobs ORDER BY created_at ASC').all();
    const filtered = rows
      .map(mapSchedulerRow)
      .filter((record) => !query.status || record.value.status === query.status)
      .filter((record) => !query.queueItemId || record.value.queueItemId === query.queueItemId)
      .filter((record) => !query.dueBefore || Date.parse(record.value.scheduledFor) <= Date.parse(query.dueBefore));

    return pageItems(filtered, query);
  }

  async findActiveByQueueItemId(queueItemId: string): Promise<Revisioned<ScheduledJob> | undefined> {
    const row = this.database
      .prepare("SELECT data_json, revision FROM scheduled_jobs WHERE queue_item_id = ? AND status = 'SCHEDULED' LIMIT 1")
      .get(queueItemId);
    return row ? mapSchedulerRow(row) : undefined;
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

    return this.updateJob(job, current.revision + 1);
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

    return this.updateJob(job, current.revision + 1);
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

    return this.updateJob(job, current.revision + 1);
  }

  private async require(id: string): Promise<Revisioned<ScheduledJob>> {
    const record = await this.getById(id);

    if (!record) {
      throw new Error(`Scheduled job was not found: ${id}.`);
    }

    return record;
  }

  private updateJob(job: ScheduledJob, revision: number): Revisioned<ScheduledJob> {
    const result = this.database.prepare(`
      UPDATE scheduled_jobs
      SET queue_item_id = ?, status = ?, scheduled_for = ?, data_json = ?, revision = ?, updated_at = ?
      WHERE id = ?
    `).run(job.queueItemId, job.status, job.scheduledFor, stringifyJson(job), revision, job.updatedAt, job.id);

    if (result.changes !== 1) {
      throw new Error(`Scheduled job was not found: ${job.id}.`);
    }

    return createRevisioned(job, revision);
  }
}

function mapSchedulerRow(row: SQLiteRow): Revisioned<ScheduledJob> {
  return createRevisioned(parseJson<ScheduledJob>(row.data_json), row.revision);
}
