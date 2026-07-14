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
import type { PostgreSQLConnection, PostgreSQLRow } from './PostgreSQLConnection.ts';
import { assertRevision, createRevisionConflict, createRevisioned, pageItems, parseJson, stringifyJson } from './PostgreSQLSerialization.ts';

export class PostgreSQLPublishingQueueRepository implements PublishingQueueRepository {
  private readonly connection: PostgreSQLConnection;

  constructor(connection: PostgreSQLConnection) {
    this.connection = connection;
  }

  async create(item: PublishingQueueItem): Promise<Revisioned<PublishingQueueItem>> {
    const revision = 1;
    await this.connection.query(`
      INSERT INTO publishing_queue_items (
        id, status, destination_type, magazine_slug, idempotency_key, data_json, revision, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
    `, [
      item.id,
      item.status,
      item.destination.type,
      stringOrNull(item.metadata?.magazineSlug),
      stringOrNull(item.metadata?.idempotencyKey),
      stringifyJson(item),
      revision,
      item.createdAt,
      item.updatedAt
    ]);

    return createRevisioned(item, revision);
  }

  async getById(id: string): Promise<Revisioned<PublishingQueueItem> | undefined> {
    const result = await this.connection.query('SELECT data_json, revision FROM publishing_queue_items WHERE id = $1', [id]);
    return result.rows[0] ? mapQueueRow(result.rows[0]) : undefined;
  }

  async list(query: PublishingQueueQuery = {}): Promise<PageResult<Revisioned<PublishingQueueItem>>> {
    const result = await this.connection.query('SELECT data_json, revision FROM publishing_queue_items ORDER BY created_at ASC');
    const filtered = result.rows
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
    const result = await this.connection.query(`
      SELECT data_json, revision FROM publishing_queue_items
      WHERE idempotency_key = $1
      ORDER BY created_at ASC
      LIMIT 1
    `, [key]);
    return result.rows[0] ? mapQueueRow(result.rows[0]) : undefined;
  }

  private async require(id: string): Promise<Revisioned<PublishingQueueItem>> {
    const record = await this.getById(id);

    if (!record) {
      throw new Error(`Publishing queue item was not found: ${id}.`);
    }

    return record;
  }

  private async updateItem(item: PublishingQueueItem, expectedRevision: number): Promise<Revisioned<PublishingQueueItem>> {
    const result = await this.connection.query(`
      UPDATE publishing_queue_items
      SET status = $1,
          destination_type = $2,
          magazine_slug = $3,
          idempotency_key = $4,
          data_json = $5::jsonb,
          revision = revision + 1,
          updated_at = $6
      WHERE id = $7 AND revision = $8
      RETURNING data_json, revision
    `, [
      item.status,
      item.destination.type,
      stringOrNull(item.metadata?.magazineSlug),
      stringOrNull(item.metadata?.idempotencyKey),
      stringifyJson(item),
      item.updatedAt,
      item.id,
      expectedRevision
    ]);

    if (result.rows[0]) {
      return mapQueueRow(result.rows[0]);
    }

    const revision = await this.getRevision(item.id);
    if (revision !== undefined) {
      throw createRevisionConflict('record', expectedRevision, revision);
    }
    throw new Error(`Publishing queue item was not found: ${item.id}.`);
  }

  private async getRevision(id: string): Promise<number | undefined> {
    const result = await this.connection.query('SELECT revision FROM publishing_queue_items WHERE id = $1', [id]);
    return result.rows[0] ? Number(result.rows[0].revision) : undefined;
  }
}

function mapQueueRow(row: PostgreSQLRow): Revisioned<PublishingQueueItem> {
  return createRevisioned(parseJson<PublishingQueueItem>(row.data_json), row.revision);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
