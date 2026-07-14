import type {
  PublishingQueueFailure,
  PublishingQueueItem
} from '../../../domain/publishingQueue/index.ts';
import type {
  PageResult,
  PublishingQueueQuery,
  PublishingQueueRepository,
  PublishingQueueStatusTransition,
  RevisionCheck,
  Revisioned
} from '../../../services/persistence/index.ts';
import type { SQLiteDatabase, SQLiteRow } from './SQLiteConnection.ts';
import { assertRevision, createRevisionConflict, createRevisioned, pageItems, parseJson, stringifyJson } from './SQLiteSerialization.ts';

export class SQLitePublishingQueueRepository implements PublishingQueueRepository {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  async create(item: PublishingQueueItem): Promise<Revisioned<PublishingQueueItem>> {
    const revision = 1;
    this.database.prepare(`
      INSERT INTO publishing_queue_items (
        id, status, destination_type, magazine_slug, idempotency_key, data_json, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.status,
      item.destination.type,
      stringOrNull(item.metadata?.magazineSlug),
      stringOrNull(item.metadata?.idempotencyKey),
      stringifyJson(item),
      revision,
      item.createdAt,
      item.updatedAt
    );

    return createRevisioned(item, revision);
  }

  async getById(id: string): Promise<Revisioned<PublishingQueueItem> | undefined> {
    const row = this.database.prepare('SELECT data_json, revision FROM publishing_queue_items WHERE id = ?').get(id);
    return row ? mapQueueRow(row) : undefined;
  }

  async list(query: PublishingQueueQuery = {}): Promise<PageResult<Revisioned<PublishingQueueItem>>> {
    const rows = this.database.prepare('SELECT data_json, revision FROM publishing_queue_items ORDER BY created_at ASC').all();
    const filtered = rows
      .map(mapQueueRow)
      .filter((record) => !query.status || record.value.status === query.status)
      .filter((record) => !query.destinationType || record.value.destination.type === query.destinationType)
      .filter((record) => !query.magazineSlug || record.value.metadata?.magazineSlug === query.magazineSlug);

    return pageItems(filtered, query);
  }

  async updateStatus(id: string, transition: PublishingQueueStatusTransition): Promise<Revisioned<PublishingQueueItem>> {
    const current = await this.require(id);
    assertRevision('record', current.revision, transition);
    const item: PublishingQueueItem = {
      ...current.value,
      status: transition.status,
      updatedAt: transition.updatedAt,
      metadata: {
        ...current.value.metadata,
        ...transition.metadata,
        scheduledAt: transition.scheduledAt ?? current.value.metadata?.scheduledAt
      }
    };

    return this.updateItem(item, current.revision);
  }

  async recordFailure(
    id: string,
    failure: PublishingQueueFailure,
    revision?: RevisionCheck
  ): Promise<Revisioned<PublishingQueueItem>> {
    const current = await this.require(id);
    assertRevision('record', current.revision, revision);
    const item: PublishingQueueItem = {
      ...current.value,
      status: 'FAILED',
      updatedAt: failure.occurredAt,
      failure
    };

    return this.updateItem(item, current.revision);
  }

  async cancel(id: string, reason: string, revision?: RevisionCheck): Promise<Revisioned<PublishingQueueItem>> {
    const current = await this.require(id);
    assertRevision('record', current.revision, revision);
    const now = new Date().toISOString();
    const item: PublishingQueueItem = {
      ...current.value,
      status: 'CANCELLED',
      updatedAt: now,
      metadata: {
        ...current.value.metadata,
        cancellationReason: reason
      }
    };

    return this.updateItem(item, current.revision);
  }

  async findByIdempotencyKey(key: string): Promise<Revisioned<PublishingQueueItem> | undefined> {
    const row = this.database
      .prepare('SELECT data_json, revision FROM publishing_queue_items WHERE idempotency_key = ? ORDER BY created_at ASC LIMIT 1')
      .get(key);
    return row ? mapQueueRow(row) : undefined;
  }

  private async require(id: string): Promise<Revisioned<PublishingQueueItem>> {
    const record = await this.getById(id);

    if (!record) {
      throw new Error(`Publishing queue item was not found: ${id}.`);
    }

    return record;
  }

  private updateItem(item: PublishingQueueItem, expectedRevision: number): Revisioned<PublishingQueueItem> {
    const result = this.database.prepare(`
      UPDATE publishing_queue_items
      SET status = ?, destination_type = ?, magazine_slug = ?, idempotency_key = ?, data_json = ?, revision = revision + 1, updated_at = ?
      WHERE id = ? AND revision = ?
    `).run(
      item.status,
      item.destination.type,
      stringOrNull(item.metadata?.magazineSlug),
      stringOrNull(item.metadata?.idempotencyKey),
      stringifyJson(item),
      item.updatedAt,
      item.id,
      expectedRevision
    );

    if (result.changes !== 1) {
      const row = this.database.prepare('SELECT revision FROM publishing_queue_items WHERE id = ?').get(item.id);
      if (row) {
        throw createRevisionConflict('record', expectedRevision, Number(row.revision));
      }
      throw new Error(`Publishing queue item was not found: ${item.id}.`);
    }

    return createRevisioned(item, expectedRevision + 1);
  }
}

function mapQueueRow(row: SQLiteRow): Revisioned<PublishingQueueItem> {
  return createRevisioned(parseJson<PublishingQueueItem>(row.data_json), row.revision);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
