import type { PageRequest, PageResult, PersistenceRevision, RevisionCheck, Revisioned } from '../PersistenceTypes.ts';

export class PersistenceRevisionConflictError extends Error {
  readonly code = 'revision_conflict';
  readonly expectedRevision?: PersistenceRevision;
  readonly actualRevision: PersistenceRevision;

  constructor(entityName: string, expectedRevision: PersistenceRevision | undefined, actualRevision: PersistenceRevision) {
    super(
      expectedRevision === undefined
        ? `${entityName} revision conflict.`
        : `${entityName} revision conflict. Expected revision ${expectedRevision}, found ${actualRevision}.`
    );
    this.name = 'PersistenceRevisionConflictError';
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export function createRevisioned<T>(value: T, revision = 1): Revisioned<T> {
  return {
    value: clone(value),
    revision
  };
}

export function nextRevision<T>(current: Revisioned<T>, value: T, revision?: RevisionCheck): Revisioned<T> {
  assertRevision('record', current.revision, revision);
  return createRevisioned(value, current.revision + 1);
}

export function assertRevision(entityName: string, actualRevision: PersistenceRevision, revision?: RevisionCheck): void {
  if (revision?.expectedRevision !== undefined && revision.expectedRevision !== actualRevision) {
    throw new PersistenceRevisionConflictError(entityName, revision.expectedRevision, actualRevision);
  }
}

export function cloneRevisioned<T>(record: Revisioned<T>): Revisioned<T> {
  return {
    value: clone(record.value),
    revision: record.revision
  };
}

export function pageItems<T>(items: T[], query: PageRequest = {}): PageResult<T> {
  const offset = query.cursor ? Number.parseInt(query.cursor.value, 10) : 0;
  const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const limit = query.limit ?? items.length;
  const page = items.slice(start, start + limit);
  const next = start + limit < items.length ? { value: String(start + limit) } : undefined;

  return {
    items: page,
    nextCursor: next
  };
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
